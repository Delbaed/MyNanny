idf_component_register(
    SRCS "main.c"
    INCLUDE_DIRS "."
    REQUIRES esp_wifi esp_event esp_netif esp_timer nvs_flash esp_driver_gpio esp_driver_uart esp_http_client json mbedtls
)
