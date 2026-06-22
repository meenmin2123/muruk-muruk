package com.muruk.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "muruk")
data class MurukProperties(
    var googleClientId: String = "",
    var corsAllowedOrigins: String = "http://localhost:3000",
    var notionRelayUrl: String = "",
)
