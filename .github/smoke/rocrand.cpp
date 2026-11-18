// rocRAND: create a generator and draw uniform numbers.
#include <hip/hip_runtime.h>
#include <rocrand/rocrand.h>

int main() {
  const size_t n = 1024;
  float* data = nullptr;
  (void)hipMalloc(&data, n * sizeof(float));

  rocrand_generator gen;
  rocrand_create_generator(&gen, ROCRAND_RNG_PSEUDO_DEFAULT);
  rocrand_set_seed(gen, 1234ULL);
  rocrand_generate_uniform(gen, data, n);
  rocrand_destroy_generator(gen);

  (void)hipFree(data);
  return 0;
}
