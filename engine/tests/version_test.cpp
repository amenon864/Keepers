#include <catch2/catch_test_macros.hpp>

#include <string_view>

#include <burstpick/version.hpp>

TEST_CASE("version returns the development version")
{
    REQUIRE(std::string_view{burstpick::version()} == "0.1.0-dev");
}
