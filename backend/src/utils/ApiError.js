// Lightweight typed error so controllers can throw with an HTTP status.
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isApiError = true;
  }

  static badRequest(msg) {
    return new ApiError(400, msg);
  }
  static unauthorized(msg = "Neautorizovano") {
    return new ApiError(401, msg);
  }
  static forbidden(msg = "Zabranjeno") {
    return new ApiError(403, msg);
  }
  static notFound(msg = "Nije pronađeno") {
    return new ApiError(404, msg);
  }
  static conflict(msg) {
    return new ApiError(409, msg);
  }
}

module.exports = ApiError;
