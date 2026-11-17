// rocThrust: reduce over a device vector.
#include <thrust/device_vector.h>
#include <thrust/reduce.h>

int main() {
  thrust::device_vector<int> values(16, 1);
  const int sum = thrust::reduce(values.begin(), values.end());
  return sum == 16 ? 0 : 1;
}
