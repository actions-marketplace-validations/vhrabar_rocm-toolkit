// hipSOLVER: query the LU workspace size.
#include <hip/hip_runtime.h>
#include <hipsolver/hipsolver.h>

int main() {
  const int n = 32;
  float* a = nullptr;
  (void)hipMalloc(&a, n * n * sizeof(float));

  hipsolverHandle_t handle;
  hipsolverCreate(&handle);
  int lwork = 0;
  hipsolverSgetrf_bufferSize(handle, n, n, a, n, &lwork);
  hipsolverDestroy(handle);

  (void)hipFree(a);
  return 0;
}
