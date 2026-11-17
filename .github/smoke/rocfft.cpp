// rocFFT: create and destroy a 1D complex plan.
#include <rocfft/rocfft.h>

int main() {
  rocfft_setup();

  const size_t lengths[1] = {1024};
  rocfft_plan plan = nullptr;
  rocfft_plan_create(&plan, rocfft_placement_inplace,
                     rocfft_transform_type_complex_forward,
                     rocfft_precision_single, 1, lengths, 1, nullptr);
  rocfft_plan_destroy(plan);

  rocfft_cleanup();
  return 0;
}
