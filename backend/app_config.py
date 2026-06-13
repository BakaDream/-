import os

TRUE_VALUES = {"1", "true", "yes", "y", "on", "enable", "enabled"}
FALSE_VALUES = {"0", "false", "no", "n", "off", "disable", "disabled"}


def read_bool_env(names, default=False):
    for name in names:
        value = os.environ.get(name)
        if value is None:
            continue

        normalized = value.strip().lower()
        if normalized in TRUE_VALUES:
            return True
        if normalized in FALSE_VALUES:
            return False

    return default


def is_ai_enabled():
    return read_bool_env(("ENABLE_AI", "enable-ai", "enable_ai"), default=True)


def get_public_config():
    return {"enableAi": is_ai_enabled()}
