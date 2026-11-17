#include <hip/hip_runtime.h>

__global__ void add_one(int* data) { data[threadIdx.x] += 1; }

int main() {
  int* d = nullptr;
  (void)hipMalloc(&d, 64 * sizeof(int));
  add_one<<<1, 64>>>(d);
  (void)hipFree(d);
  return 0;
}
