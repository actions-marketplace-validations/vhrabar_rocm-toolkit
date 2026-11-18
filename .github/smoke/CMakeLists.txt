cmake_minimum_required(VERSION 3.21)

set(SMOKE_GFX "gfx1200" CACHE STRING "GPU target to compile device code for")
option(SMOKE_REQUIRE_LIBS "Fail if a ROCm library is not installed" OFF)

if(NOT CMAKE_PREFIX_PATH AND DEFINED ENV{ROCM_PATH})
  set(CMAKE_PREFIX_PATH "$ENV{ROCM_PATH}")
endif()
if(NOT CMAKE_PREFIX_PATH)
  message(FATAL_ERROR "Set ROCM_PATH or -DCMAKE_PREFIX_PATH to the ROCm root.")
endif()

list(GET CMAKE_PREFIX_PATH 0 ROCM_ROOT)

# Use the ROCm compiler (avoid installing other compilers into runner)
find_program(ROCM_CLANG NAMES amdclang
  HINTS "${ROCM_ROOT}/bin" "${ROCM_ROOT}/lib/llvm/bin" NO_DEFAULT_PATH)
find_program(ROCM_CLANGXX NAMES amdclang++
  HINTS "${ROCM_ROOT}/bin" "${ROCM_ROOT}/lib/llvm/bin" NO_DEFAULT_PATH)
if(NOT ROCM_CLANG OR NOT ROCM_CLANGXX)
  message(FATAL_ERROR "amdclang / amdclang++ not found under ${ROCM_ROOT}")
endif()
set(CMAKE_C_COMPILER "${ROCM_CLANG}" CACHE FILEPATH "")
set(CMAKE_CXX_COMPILER "${ROCM_CLANGXX}" CACHE FILEPATH "")
set(CMAKE_HIP_COMPILER "${ROCM_CLANGXX}" CACHE FILEPATH "")
set(CMAKE_HIP_ARCHITECTURES "${SMOKE_GFX}" CACHE STRING "")

# set GPU target explicitly, as runner has no GPU to detect
set(GPU_TARGETS "${SMOKE_GFX}" CACHE STRING "")
set(AMDGPU_TARGETS "${SMOKE_GFX}" CACHE STRING "")

# rocPRIM, hipCUB and rocThrust need C++17.
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_HIP_STANDARD 17)
set(CMAKE_HIP_STANDARD_REQUIRED ON)

project(rocm_smoke LANGUAGES CXX HIP)

find_package(hip REQUIRED CONFIG)

# The compiler: a HIP kernel built through CMake's HIP language support.
add_executable(smoke_hello hello.hip)
target_link_libraries(smoke_hello PRIVATE hip::device)

# One executable per select ROCm/HIP library. Each is skipped (or fails, with
# SMOKE_REQUIRE_LIBS) when the library's CMake package is not installed.
function(smoke_library package target source)
  find_package(${package} CONFIG QUIET)
  if(${package}_FOUND)
    get_filename_component(name "${source}" NAME_WE)
    get_filename_component(ext "${source}" LAST_EXT)
    if(ext STREQUAL ".hip")
      set(hip_target hip::device)
    else()
      set(hip_target hip::host)
    endif()
    add_executable(smoke_${name} ${source})
    target_link_libraries(smoke_${name} PRIVATE ${target} ${hip_target})
    message(STATUS "${package}: found, building smoke_${name}")
  elseif(SMOKE_REQUIRE_LIBS)
    message(FATAL_ERROR "${package} was not found under ${CMAKE_PREFIX_PATH}")
  else()
    message(STATUS "${package}: not installed, skipped")
  endif()
endfunction()

# ROCm libraries
smoke_library(rocblas roc::rocblas rocblas.cpp)
smoke_library(rocfft roc::rocfft rocfft.cpp)
smoke_library(rocrand roc::rocrand rocrand.cpp)
smoke_library(rocsparse roc::rocsparse rocsparse.cpp)
smoke_library(rocsolver roc::rocsolver rocsolver.cpp)

# hip-prefixed portability layers
smoke_library(hipblas roc::hipblas hipblas.cpp)
smoke_library(hipfft hip::hipfft hipfft.cpp)
smoke_library(hiprand hip::hiprand hiprand.cpp)
smoke_library(hipsparse roc::hipsparse hipsparse.cpp)
smoke_library(hipsolver roc::hipsolver hipsolver.cpp)

# Header-only libraries that instantiate device code
smoke_library(hipcub hip::hipcub hipcub.hip)
smoke_library(rocprim roc::rocprim rocprim.hip)
smoke_library(rocthrust roc::rocthrust rocthrust.hip)
