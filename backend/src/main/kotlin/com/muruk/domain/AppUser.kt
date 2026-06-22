package com.muruk.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/** 구글 계정 1개 = 사용자 1명. sub(구글 고유 ID)를 기본키로 사용. */
@Entity
@Table(name = "app_user")
class AppUser(
    @Id
    @Column(length = 64)
    var id: String = "", // 구글 sub

    @Column(nullable = false)
    var email: String = "",

    @Column(nullable = false)
    var name: String = "",

    @Column(length = 1024)
    var picture: String? = null,

    @Column(nullable = false)
    var createdAt: Instant = Instant.now(),

    @Column(nullable = false)
    var lastSeenAt: Instant = Instant.now(),
)
