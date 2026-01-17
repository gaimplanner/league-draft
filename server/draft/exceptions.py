from rest_framework.views import exception_handler
from rest_framework.response import Response


def custom_exception_handler(exc, context):
    """Custom exception handler for consistent error responses."""
    response = exception_handler(exc, context)

    if response is not None:
        # Customize the response format
        if isinstance(response.data, dict):
            if "detail" in response.data:
                response.data = {"error": response.data["detail"]}
        elif isinstance(response.data, list):
            response.data = {"error": response.data[0] if response.data else "Unknown error"}

    return response
