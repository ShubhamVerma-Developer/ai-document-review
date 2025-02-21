import { AuthenticationResult, EventMessage, EventType, PublicClientApplication } from '@azure/msal-browser';
import { BlobServiceClient } from '@azure/storage-blob';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from "./App";
import { msalConfig } from './authConfig';
import './index.css';

class MsalAzureCredential {
    async getToken(
      requestedScopes: string | string[]
    ): Promise<{ token: string; expiresOnTimestamp: number }> {
        const request = {
            scopes: Array.isArray(requestedScopes) ? requestedScopes : [requestedScopes]
        }
        const response = await msalInstance.acquireTokenSilent(request);
        return {
            token: response.accessToken,
            expiresOnTimestamp: response.expiresOn!.getTime()
        }
    }
}

export const msalInstance = new PublicClientApplication(msalConfig);

export const storageClient = new BlobServiceClient(import.meta.env.VITE_STORAGE_ACCOUNT!, new MsalAzureCredential());

export const containerClient = storageClient.getContainerClient(import.meta.env.VITE_STORAGE_DOCUMENT_CONTAINER!);

msalInstance.initialize().then(() => {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
        msalInstance.setActiveAccount(accounts[0]);
    }

    msalInstance.addEventCallback((event: EventMessage) => {
        if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
            const payload = event.payload as AuthenticationResult;
            const account = payload.account;
            msalInstance.setActiveAccount(account);
        }
    });

    const root = ReactDOM.createRoot(
        document.getElementById("root") as HTMLElement
    );
    root.render(
        <Router>
            <FluentProvider theme={webLightTheme}>
                <App pca={msalInstance} />
            </FluentProvider>
        </Router>
    );
});
