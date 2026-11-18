// rocBLAS: single-precision matrix-matrix multiply (SGEMM).
#include <hip/hip_runtime.h>
#include <rocblas/rocblas.h>

int main() {
  const int n = 64;
  float *a = nullptr, *b = nullptr, *c = nullptr;
  (void)hipMalloc(&a, n * n * sizeof(float));
  (void)hipMalloc(&b, n * n * sizeof(float));
  (void)hipMalloc(&c, n * n * sizeof(float));

  rocblas_handle handle;
  rocblas_create_handle(&handle);
  const float alpha = 1.0f, beta = 0.0f;
  rocblas_sgemm(handle, rocblas_operation_none, rocblas_operation_none, n, n, n,
                &alpha, a, n, b, n, &beta, c, n);
  rocblas_destroy_handle(handle);

  (void)hipFree(a);
  (void)hipFree(b);
  (void)hipFree(c);
  return 0;
}
