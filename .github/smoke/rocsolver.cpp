// rocSOLVER: LU factorization.
#include <hip/hip_runtime.h>
#include <rocsolver/rocsolver.h>

int main() {
  const rocblas_int n = 32;
  float* a = nullptr;
  rocblas_int *ipiv = nullptr, *info = nullptr;
  (void)hipMalloc(&a, n * n * sizeof(float));
  (void)hipMalloc(&ipiv, n * sizeof(rocblas_int));
  (void)hipMalloc(&info, sizeof(rocblas_int));

  rocblas_handle handle;
  rocblas_create_handle(&handle);
  rocsolver_sgetrf(handle, n, n, a, n, ipiv, info);
  rocblas_destroy_handle(handle);

  (void)hipFree(a);
  (void)hipFree(ipiv);
  (void)hipFree(info);
  return 0;
}
