package com.muruk.web

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.muruk.domain.UserState
import com.muruk.repo.UserStateRepository
import com.muruk.security.CurrentUserHolder
import com.muruk.service.CoachingService
import com.muruk.service.NotionBackupService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.time.Instant

@RestController
@RequestMapping("/api")
class HealthController {
    @GetMapping("/health")
    fun health(): Map<String, Any> = mapOf("ok" to true, "service" to "muruk-backend")
}

/** 로그인 후 내 프로필 확인용. */
@RestController
@RequestMapping("/api")
class MeController {
    @GetMapping("/me")
    fun me(): Map<String, Any?> {
        val u = CurrentUserHolder.require()
        return mapOf("id" to u.id, "email" to u.email, "name" to u.name, "picture" to u.picture)
    }
}

/**
 * 사용자별 앱 상태(목표/할일/기록 전체)의 받기/올리기.
 *
 * 응답/요청은 봉투(envelope) 형태:
 *   GET  → { "data": {...}, "version": n, "updatedAt": "..." }
 *   PUT  body { "data": {...}, "baseVersion": n } → 저장 후 같은 봉투 반환.
 * baseVersion 이 서버 버전과 다르면 409(다른 기기에서 먼저 변경됨).
 */
@RestController
@RequestMapping("/api/state")
class StateController(
    private val states: UserStateRepository,
    private val mapper: ObjectMapper,
    private val notion: NotionBackupService,
) {
    @GetMapping
    fun pull(): Map<String, Any?> {
        val u = CurrentUserHolder.require()
        val entity = states.findById(u.id).orElse(null)
        return mapOf(
            "data" to mapper.readTree(entity?.data ?: "{}"),
            "version" to (entity?.version ?: 0L),
            "updatedAt" to entity?.updatedAt?.toString(),
        )
    }

    @PutMapping
    fun push(@RequestBody body: StatePush): Map<String, Any?> {
        val u = CurrentUserHolder.require()
        val existing = states.findById(u.id).orElse(null)

        // 클라이언트가 본 버전과 서버 버전이 다르면 충돌.
        if (existing != null && body.baseVersion != null && body.baseVersion != existing.version) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "stale version: ${body.baseVersion} != ${existing.version}")
        }

        val json = mapper.writeValueAsString(body.data ?: mapper.createObjectNode())
        val entity = existing ?: UserState(userId = u.id)
        entity.data = json
        entity.updatedAt = Instant.now()
        val saved = states.save(entity)
        notion.backup(u.id, json) // Postgres 저장 후 노션 백업(비동기, best-effort)
        return mapOf("ok" to true, "version" to saved.version, "updatedAt" to saved.updatedAt.toString())
    }
}

data class StatePush(val data: JsonNode? = null, val baseVersion: Long? = null)

data class CoachRequest(val kind: String = "encourage", val context: String = "")
data class CoachResponse(val message: String)

/** Claude 기반 AI 코칭. */
@RestController
@RequestMapping("/api/coach")
class CoachController(private val coaching: CoachingService) {
    @PostMapping
    fun coach(@RequestBody req: CoachRequest): CoachResponse {
        CurrentUserHolder.require() // 로그인 필수
        return CoachResponse(coaching.coach(req.kind, req.context))
    }
}
