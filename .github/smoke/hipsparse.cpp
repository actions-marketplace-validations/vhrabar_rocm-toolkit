// hipSPARSE: create a handle and a matrix descriptor.
#include <hipsparse/hipsparse.h>

int main() {
  hipsparseHandle_t handle;
  hipsparseCreate(&handle);
  hipsparseMatDescr_t descr;
  hipsparseCreateMatDescr(&descr);

  hipsparseDestroyMatDescr(descr);
  hipsparseDestroy(handle);
  return 0;
}
