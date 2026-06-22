package com.muruk.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

/**
 * 사용자별 앱 상태(목표/할일/기록 전체)를 JSON 문서로 저장.
 * 기존 PWA가 통째로 동기화하는 구조와 맞물려 가장 단순하고 안전한 1차 골격.
 * (나중에 dreams/goals/todos 정규화 테이블로 확장 가능)
 */
@Entity
@Table(name = "user_state")
class UserState(
    @Id
    @Column(length = 64)
    var userId: String = "",

    // Postgres에선 jsonb, H2에선 JSON/CLOB 으로 매핑됨
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    var data: String = "{}",

    @Column(nullable = false)
    var updatedAt: Instant = Instant.now(),
)
