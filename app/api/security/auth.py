from fastapi import Depends
from fastapi_azure_auth import SingleTenantAzureAuthorizationCodeBearer
from fastapi_azure_auth.auth import User
from config.config import settings

# Configure the SingleTenantAzureAuthorizationCodeBearer
azure_scheme = SingleTenantAzureAuthorizationCodeBearer(
    app_client_id=settings.aad_client_id,
    tenant_id=settings.aad_tenant_id,  # Required for single tenant setup
    allow_guest_users=True,
    scopes={
        settings.aad_user_impersonation_scope_id : 'user_impersonation',
    }
)

async def validate_authenticated(user: User = Depends(azure_scheme)) -> User:
    """
    Validate that a user is authenticated
    """
    
    return user
