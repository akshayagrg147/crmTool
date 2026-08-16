from app.models.integration import IntegrationProvider
from app.services.integrations.base import ProviderAdapter
from app.services.integrations.indiamart import IndiaMartAdapter
from app.services.integrations.justdial import JustDialAdapter

_ADAPTERS: dict[IntegrationProvider, ProviderAdapter] = {
    IntegrationProvider.indiamart: IndiaMartAdapter(),
    IntegrationProvider.justdial: JustDialAdapter(),
}


def get_adapter(provider: IntegrationProvider) -> ProviderAdapter:
    return _ADAPTERS[provider]


def all_adapters() -> list[ProviderAdapter]:
    return list(_ADAPTERS.values())
