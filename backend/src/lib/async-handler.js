export function asyncHandler(callback) {
  return async function wrappedHandler(request, response, next) {
    try {
      await callback(request, response, next)
    } catch (error) {
      next(error)
    }
  }
}