// rocSPARSE: create a handle and a matrix descriptor.
#include <rocsparse/rocsparse.h>

int main() {
  rocsparse_handle handle;
  rocsparse_create_handle(&handle);
  rocsparse_mat_descr descr;
  rocsparse_create_mat_descr(&descr);

  rocsparse_destroy_mat_descr(descr);
  rocsparse_destroy_handle(handle);
  return 0;
}
