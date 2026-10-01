package com.muruk

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableAsync

@SpringBootApplication
@EnableAsync
class MurukApplication

/**
 * 기동 직후 DB 설정이 '실제로 무엇으로 들어왔는지' 한 줄씩 남긴다.
 *
 * 접속이 실패하면 Hibernate 가 늘 같은 문장으로 끝난다 —
 * "Unable to determine Dialect without JDBC metadata". 비밀번호가 틀려도,
 * 호스트가 없어도, 값이 아예 안 들어와도 전부 그 한 문장이라, 그 로그만으로는
 * 원인을 가릴 수 없다. 실제로 운영에서 이 문장만 보고 한참 헤맸다.
 *
 * 그래서 값 자체가 도착했는지를 기동 시점에 먼저 찍는다.
 * 비밀은 남기지 않는다 — 길이만 적고, URL 은 자격증명이 섞여 들어온 경우를 대비해
 * '@' 앞부분을 지운 뒤 찍는다.
 */
private fun logDbEnv() {
    fun mask(v: String?): String = when {
        v == null -> "NOT SET (null)"
        v.isEmpty() -> "EMPTY STRING (length=0)"
        else -> "SET (length=${v.length})"
    }

    val url = System.getenv("DB_URL")
    // user:password@host 형태로 잘못 들어온 경우를 대비해 '@' 앞을 지우고 찍는다
    val safeUrl = url?.let {
        val at = it.lastIndexOf('@')
        if (at >= 0) "<credentials removed>@" + it.substring(at + 1) else it
    }

    println("[startup] SPRING_PROFILES_ACTIVE = " + (System.getenv("SPRING_PROFILES_ACTIVE") ?: "NOT SET"))
    println("[startup] DB_URL      : " + mask(url))
    println("[startup] DB_URL value: " + (safeUrl ?: "-"))
    println("[startup] DB_USER     : " + mask(System.getenv("DB_USER")) + " / value = " + (System.getenv("DB_USER") ?: "-"))
    println("[startup] DB_PASSWORD : " + mask(System.getenv("DB_PASSWORD")))
    println("[startup] legacy vars : DB_HOST=" + mask(System.getenv("DB_HOST")) + " DB_PORT=" + mask(System.getenv("DB_PORT")) + " DB_NAME=" + mask(System.getenv("DB_NAME")))
}

fun main(args: Array<String>) {
    logDbEnv()
    runApplication<MurukApplication>(*args)
}
