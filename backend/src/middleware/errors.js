export function notFoundHandler(_request, _response, next) {
  const error = new Error('Route not found')
  error.status = 404
  next(error)
}

export function errorHandler(error, _request, response, _next) {
  const status = error.status || 500
  response.status(status).json({
    message: error.message || 'Unexpected server error',
  })
}