// hipCUB: device-wide reduction (workspace-size query).
#include <hipcub/hipcub.hpp>

int main() {
  int *in = nullptr, *out = nullptr;
  size_t bytes = 0;
  (void)hipcub::DeviceReduce::Sum(nullptr, bytes, in, out, 1024);
  return 0;
}
