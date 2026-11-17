// hipFFT: 1D complex plan.
#include <hipfft/hipfft.h>

int main() {
  hipfftHandle plan;
  hipfftPlan1d(&plan, 1024, HIPFFT_C2C, 1);
  hipfftDestroy(plan);
  return 0;
}
