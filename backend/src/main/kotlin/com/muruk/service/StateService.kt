package com.muruk.service

import com.muruk.domain.UserState
import com.muruk.repo.UserStateRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.dao.OptimisticLockingFailureException
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Instant

/**
 * 사용자 상태의 읽기/쓰기를 하나의 트랜잭션 안에서 처리한다.
 *
 * 컨트롤러가 아니라 서비스에 트랜잭션을 두는 이유:
 * 조회 → baseVersion 검사 → 저장이 서로 다른 트랜잭션에서 일어나면
 * 동시 요청 두 건이 같은 baseVersion 검사를 모두 통과할 수 있다(TOCTOU).
 * 한 트랜잭션으로 묶고 마지막에 saveAndFlush 로 즉시 flush 하면,
 * 그 틈에 들어온 다른 저장은 @Version 검사에 걸려 409 로 돌아간다.
 */
@Service
class StateService(private val states: UserStateRepository) {

    @Transactional(readOnly = true)
    fun load(userId: String): UserState? = states.findById(userId).orElse(null)

    /**
     * 상태를 저장하고 갱신된 엔티티를 반환한다.
     * baseVersion 이 서버 버전과 다르거나 누락되면 409 — 클라이언트가 최신본을 받아 병합해야 한다.
     */
    @Transactional
    fun save(userId: String, json: String, baseVersion: Long?): UserState {
        val existing = states.findById(userId).orElse(null)

        // 기존 행이 있는데 클라이언트가 본 버전이 다르면(또는 아예 안 보냈으면) 덮어쓰지 않는다.
        // baseVersion 누락을 통과시키면 오래된 클라이언트가 최신 데이터를 통째로 지울 수 있다.
        if (existing != null && baseVersion != existing.version) {
            throw ResponseStatusException(HttpStatus.CONFLICT, conflictMessage(baseVersion, existing.version))
        }

        val entity = existing ?: UserState(userId = userId)
        entity.data = json
        entity.updatedAt = Instant.now()

        return try {
            // saveAndFlush: 트랜잭션 커밋까지 미루지 않고 지금 flush 한다.
            //  1) @Version 증가분이 반영된 엔티티를 그대로 반환할 수 있고,
            //  2) 동시 저장 충돌을 여기서 잡아 409 로 바꿀 수 있다.
            states.saveAndFlush(entity)
        } catch (e: OptimisticLockingFailureException) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "동시에 다른 저장이 끼어들었습니다 — 최신 상태를 받아 병합해주세요",
                e,
            )
        } catch (e: DataIntegrityViolationException) {
            // 두 기기가 '첫 저장'을 동시에 해서 같은 PK 를 INSERT 한 경우.
            // 서버 오류가 아니라 충돌이므로 409 로 알려 클라이언트가 병합하도록 한다.
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "다른 기기가 먼저 만들었습니다 — 최신 상태를 받아 병합해주세요",
                e,
            )
        }
    }

    private fun conflictMessage(base: Long?, server: Long): String =
        if (base == null) "baseVersion 이 없습니다 — 최신 상태를 받아 다시 저장해주세요 (server=$server)"
        else "stale version: $base != $server"
}
