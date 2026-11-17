// rocPRIM: device-wide reduction (workspace-size query).
#include <rocprim/rocprim.hpp>

int main() {
  int *in = nullptr, *out = nullptr;
  size_t bytes = 0;
  (void)rocprim::reduce(nullptr, bytes, in, out, 0, size_t{1024},
                        rocprim::plus<int>());
  return 0;
}
