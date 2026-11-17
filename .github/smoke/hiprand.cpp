// hipRAND: uniform random numbers.
#include <hip/hip_runtime.h>
#include <hiprand/hiprand.h>

int main() {
  const size_t n = 1024;
  float* data = nullptr;
  (void)hipMalloc(&data, n * sizeof(float));

  hiprandGenerator_t gen;
  hiprandCreateGenerator(&gen, HIPRAND_RNG_PSEUDO_DEFAULT);
  hiprandSetPseudoRandomGeneratorSeed(gen, 1234ULL);
  hiprandGenerateUniform(gen, data, n);
  hiprandDestroyGenerator(gen);

  (void)hipFree(data);
  return 0;
}
