package com.muruk.service

import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.models.messages.MessageCreateParams
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

/**
 * Claude(Opus 4.8)로 사용자 데이터에 맞춘 AI 코칭 메시지를 생성.
 * API 키는 표준 환경변수 ANTHROPIC_API_KEY 로 주입됨.
 */
@Service
class CoachingService {

    private val log = LoggerFactory.getLogger(javaClass)

    // 키가 없으면 null — 호출 시 안내 메시지로 폴백
    private val client: AnthropicClient? by lazy {
        runCatching { AnthropicOkHttpClient.fromEnv() }
            .onFailure { log.warn("Anthropic 클라이언트 초기화 실패(ANTHROPIC_API_KEY 미설정?): {}", it.message) }
            .getOrNull()
    }

    private val systemPrompt = """
        당신은 '무럽무럽'이라는 목표·습관 관리 앱의 따뜻한 AI 코치입니다.
        사용자가 작은 실천을 매일 꾸준히 이어가도록 응원하고 도와줍니다.
        규칙:
        - 한국어로, 다정하고 담백하게. 과장된 칭찬·이모지 남발은 피합니다.
        - 사용자의 실제 데이터(연속 기록, 완료 수, 목표)를 근거로 구체적으로 말합니다.
        - 길게 늘어놓지 말고 2~3문장으로 핵심만. 부담 주지 않습니다.
        - "작심삼일도 꾸준히 하면 됩니다" 라는 앱의 철학을 지킵니다.
    """.trimIndent()

    /** kind: 코칭 유형, context: 사용자 상태 요약(JSON/텍스트). */
    fun coach(kind: String, context: String): String {
        val c = client ?: return "AI 코치를 사용하려면 서버에 ANTHROPIC_API_KEY를 설정해 주세요."
        val userPrompt = buildString {
            append("코칭 유형: ").append(kind).append('\n')
            append("사용자 상태:\n").append(context.take(8000))
            append("\n\n위 정보를 바탕으로 코칭 메시지를 작성해줘.")
        }
        val params = MessageCreateParams.builder()
            .model("claude-opus-4-8")
            .maxTokens(512L)
            .system(systemPrompt)
            .addUserMessage(userPrompt)
            .build()

        val message = c.messages().create(params)
        return message.content()
            .stream()
            .flatMap { it.text().stream() }
            .map { it.text() }
            .toList()
            .joinToString("")
            .trim()
            .ifBlank { "오늘도 한 걸음, 그거면 충분해요." }
    }
}
