package com.muruk

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableAsync

@SpringBootApplication
@EnableAsync
class MurukApplication

fun main(args: Array<String>) {
    runApplication<MurukApplication>(*args)
}
