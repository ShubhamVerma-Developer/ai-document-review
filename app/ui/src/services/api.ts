import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { EventSourceMessage, fetchEventSource } from '@microsoft/fetch-event-source'
import { accessTokenRequest } from '../authConfig'
import { msalInstance } from '../main'
import { FatalError, RetriableError } from '../types/error'

const apiBaseUrl = '/api/v1/review/'
const unknownError = 'an unknown error occurred. Please try again.'

class AbortedError extends Error {}

export async function getAccessToken() {
  const account = msalInstance.getActiveAccount()!

  try {
    const tokenResponse = await msalInstance.acquireTokenSilent({
      ...accessTokenRequest,
      account
    })
    return tokenResponse.accessToken
  } catch (err) {
    console.warn('Unable to get a token silently', err)
    if (err instanceof InteractionRequiredAuthError) {
      const tokenResponse = await msalInstance.acquireTokenPopup({
        ...accessTokenRequest,
        account
      })
      return tokenResponse.accessToken
    }
  }
}

async function getErrorMessage(response: Response): Promise<string> {
  let message = `API error (${response.statusText}): `

  const errorText = await response.text()
  if (errorText) {
    let errorJson
    try {
      errorJson = JSON.parse(errorText)
      if (errorJson?.detail) {
        if (typeof errorJson.detail === 'string') {
          message += errorJson.detail
        } else {
          message += JSON.stringify(errorJson.detail)
        }
      } else if (errorJson?.message) {
        message += errorJson.message
      } else {
        message += unknownError
      }
    } catch {
      message += unknownError
    }
  } else {
    message += unknownError
  }

  return message
}

export async function callApi(path: string, method = 'GET', body?: object) {
  const token = await getAccessToken()

  const response = await fetch(apiBaseUrl + path, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    method,
    body: body ? JSON.stringify(body) : null
  })

  if (!response.ok) {
    const message = await getErrorMessage(response)
    if (response.status === 503) {
      throw new RetriableError(message)
    } else {
      throw new FatalError(message)
    }
  }

  return response
}

export async function streamApi(
  path: string,
  messageHandler: (msg: EventSourceMessage) => void,
  fatalErrorHandler: (err: Error) => void,
  abortControllerRef: AbortController,
  maxRetries = 3
) {
  let retries = 0

  async function startStream() {
    const token = await getAccessToken()

    fetchEventSource(apiBaseUrl + path, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      signal: abortControllerRef.signal,
      async onopen(response) {
        if (abortControllerRef.signal.aborted) {
          console.log('Stream aborted before open')
          throw new AbortedError()
        }
        console.log('Stream opened', response)
        if (!response.ok) {
          const message = await getErrorMessage(response)
          if (response.status === 503) {
            throw new RetriableError(message)
          } else {
            throw new FatalError(message)
          }
        }
      },
      onmessage(msg) {
        console.log('Message:', msg)
        messageHandler(msg)
      },
      onclose() {
        console.log('Stream closed')
      },
      onerror(err) {
        console.error('Stream error', err)
        // If the error is retriable, attempt to retry
        if (err instanceof RetriableError && retries < maxRetries) {
          retries++
          console.log(`Retrying stream... (${retries}/${maxRetries})`)
          startStream()
        } else {
          throw err
        }
      }
    }).catch(fatalErrorHandler)
  }

  startStream()
}
