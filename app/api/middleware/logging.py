from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
import logging
import time
from opencensus.ext.azure.log_exporter import AzureLogHandler
from config.config import settings


class LoggingMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.logger = logging.getLogger(__name__)

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()

        # Log incoming request details
        client_ip = request.client.host
        user_agent = request.headers.get("user-agent", "unknown")
        self.logger.info(
            f"""Received {request.method} for
            {request.url} from {client_ip} using {user_agent}"""
        )

        try:
            # Proceed with request processing
            response = await call_next(request)
        except Exception as exc:
            # Log exception if it occurs
            process_time = time.time() - start_time
            self.logger.error(
                f"""Exception during {request.method}
                Url {request.url} after {process_time:.2f}s: {str(exc)}""",
                exc_info=True,
            )
            raise

        # Log the response details
        process_time = time.time() - start_time
        self.logger.info(
            f"""{request.method} {request.url}
            completed in {process_time:.2f}s
            with status {response.status_code}"""
        )

        return response

def setup_logging():
    # Set up basic logging configuration
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    logging.basicConfig(
        level=logging.INFO,  # Default logging level
        format=log_format,
    )

    # Add a file handler
    file_handler = logging.FileHandler("app.log")
    file_handler.setLevel(logging.INFO)
    file_formatter = logging.Formatter(log_format)
    file_handler.setFormatter(file_formatter)

    # Add Azure Log Handler for Application Insights
    instrumentation_key = f"InstrumentationKey={settings.appinsights_instrumentation_key}"
    azure_handler = AzureLogHandler(connection_string=instrumentation_key)
    level = getattr(logging, str(settings.log_level).upper(), logging.INFO)
    azure_handler.setLevel(level)
    azure_formatter = logging.Formatter(log_format)
    azure_handler.setFormatter(azure_formatter)

    # Get the root logger and add both handlers
    logger = logging.getLogger()
    logger.addHandler(file_handler)
    logger.addHandler(azure_handler)
