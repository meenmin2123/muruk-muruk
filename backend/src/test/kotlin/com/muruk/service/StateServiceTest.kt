package com.muruk.service

import com.muruk.repo.UserStateRepository
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest
import org.springframework.context.annotation.Import
import org.springframework.http.HttpStatus
import org.springframework.test.context.TestPropertySource
import org.springframework.web.server.ResponseStatusException

/**
 * 상태 저장의 충돌 규칙 검증.
 *
 * 여기서 막는 사고: 오래된(또는 baseVersion 을 안 보내는) 클라이언트가
 * 다른 기기에서 방금 저장한 데이터를 통째로 덮어써 사용자 기록이 사라지는 것.
 */
@DataJpaTest
// UserState.data 는 columnDefinition="jsonb" 라 H2 기본 모드에서는 CREATE TABLE 이 실패한다
// (하이버네이트는 DDL 오류를 경고로만 남기고 넘어가므로, 나중에 "테이블 없음"으로 터진다).
// 아래 URL 의 MODE=PostgreSQL 이 실제로 쓰이도록 테스트 DB 자동 교체를 끈다.
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(StateService::class)
@TestPropertySource(
    properties = [
        // 운영(Postgres)과 같은 JSON 컬럼 매핑이 되도록 H2 를 PostgreSQL 모드로.
        "spring.datasource.url=jdbc:h2:mem:statesvc;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        // DDL 이 실패하면 조용히 넘어가지 말고 즉시 실패시킨다.
        "spring.jpa.properties.hibernate.hbm2ddl.halt_on_error=true",
    ],
)
class StateServiceTest {

    @Autowired lateinit var service: StateService

    @Autowired lateinit var states: UserStateRepository

    private val user = "google-sub-1"

    @Test
    fun `행이 없으면 새로 만들고 최초 버전 0을 돌려준다`() {
        val saved = service.save(user, """{"totalDone":1}""", baseVersion = 0)

        assertThat(saved.userId).isEqualTo(user)
        assertThat(saved.data).contains("totalDone")
        // 하이버네이트는 INSERT 시 @Version 을 0 으로 매기고, 이후 UPDATE 마다 1씩 올린다.
        // 프론트의 versionRef 도 0 에서 시작하므로 최초 저장 계약이 맞아떨어진다.
        assertThat(saved.version).isEqualTo(0L)
    }

    @Test
    fun `저장할 때마다 버전이 올라가고 반환값에 즉시 반영된다`() {
        val v1 = service.save(user, """{"n":1}""", baseVersion = 0).version
        // v1 을 그대로 다음 baseVersion 으로 쓸 수 있어야 한다.
        // saveAndFlush 가 아니라 save 였다면 flush 전 옛 버전이 반환되어
        // 두 번째 저장이 곧바로 409 가 되고 클라이언트가 영구 충돌에 빠진다.
        val v2 = service.save(user, """{"n":2}""", baseVersion = v1).version
        val v3 = service.save(user, """{"n":3}""", baseVersion = v2).version

        assertThat(listOf(v1, v2, v3)).isEqualTo(listOf(0L, 1L, 2L))
        assertThat(states.findById(user).get().data).contains(""""n":3""")
    }

    @Test
    fun `오래된 baseVersion 은 409 로 거절한다`() {
        val current = service.save(user, """{"n":1}""", baseVersion = 0).version

        assertThatThrownBy { service.save(user, """{"n":"stale"}""", baseVersion = current - 1) }
            .isInstanceOfSatisfying(ResponseStatusException::class.java) {
                assertThat(it.statusCode.value()).isEqualTo(HttpStatus.CONFLICT.value())
            }

        // 거절된 저장은 데이터를 건드리지 않아야 한다.
        assertThat(states.findById(user).get().data).contains(""""n":1""")
    }

    @Test
    fun `baseVersion 을 아예 안 보내면 기존 데이터를 덮어쓰지 않고 409`() {
        service.save(user, """{"keep":"me"}""", baseVersion = 0)

        assertThatThrownBy { service.save(user, """{"wipe":true}""", baseVersion = null) }
            .isInstanceOfSatisfying(ResponseStatusException::class.java) {
                assertThat(it.statusCode.value()).isEqualTo(HttpStatus.CONFLICT.value())
            }

        assertThat(states.findById(user).get().data).contains("keep")
    }

    @Test
    fun `사용자별로 상태가 분리된다`() {
        service.save("user-a", """{"who":"a"}""", baseVersion = 0)
        service.save("user-b", """{"who":"b"}""", baseVersion = 0)

        assertThat(states.findById("user-a").get().data).contains(""""who":"a"""")
        assertThat(states.findById("user-b").get().data).contains(""""who":"b"""")
    }

    @Test
    fun `저장한 적 없는 사용자는 load 가 null`() {
        assertThat(service.load("nobody")).isNull()
    }
}
