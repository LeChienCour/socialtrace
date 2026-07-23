from fastapi import FastAPI

from socialtrace.api.health import router as health_router


def create_app() -> FastAPI:
    app = FastAPI(title="socialtrace")
    app.include_router(health_router)
    return app


app = create_app()
