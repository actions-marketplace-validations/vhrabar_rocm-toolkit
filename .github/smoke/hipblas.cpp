// hipBLAS: SGEMM through the portable hipBLAS API.
#include <hip/hip_runtime.h>
#include <hipblas/hipblas.h>

int main() {
  const int n = 64;
  float *a = nullptr, *b = nullptr, *c = nullptr;
  (void)hipMalloc(&a, n * n * sizeof(float));
  (void)hipMalloc(&b, n * n * sizeof(float));
  (void)hipMalloc(&c, n * n * sizeof(float));

  hipblasHandle_t handle;
  hipblasCreate(&handle);
  const float alpha = 1.0f, beta = 0.0f;
  hipblasSgemm(handle, HIPBLAS_OP_N, HIPBLAS_OP_N, n, n, n, &alpha, a, n, b, n,
               &beta, c, n);
  hipblasDestroy(handle);

  (void)hipFree(a);
  (void)hipFree(b);
  (void)hipFree(c);
  return 0;
}
