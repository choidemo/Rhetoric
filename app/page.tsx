'use client';

import { useState, useEffect, useRef } from 'react';

interface Turn {
  role: '교사' | '학생' | '시스템' | '학생 (최종 반응)';
  text: string;
}

export default function Home() {
  const [conversationHistory, setConversationHistory] = useState<Turn[]>([]);
  const [counselingTurnsLeft, setCounselingTurnsLeft] = useState<number>(5);
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [counselingStarted, setCounselingStarted] = useState<boolean>(false);
  const [counselingEnded, setCounselingEnded] = useState<boolean>(false);
  const [teacherEvaluationResult, setTeacherEvaluationResult] = useState<string>('');

  const chatboxRef = useRef<HTMLDivElement>(null);

  const counselingTopic = "학교 규칙 위반 및 친구 관계 문제";

  useEffect(() => {
    if (chatboxRef.current) {
      chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
    }
  }, [conversationHistory]);

  const appendMessage = (role: Turn['role'], text: string) => {
    setConversationHistory(prev => [...prev, { role, text }]);
  };

  const startCounseling = () => {
    setCounselingStarted(true);
    const openingMessage = `선생님, 저 부르셨어요? 또 무슨 일로요?`;
    appendMessage('학생', openingMessage);
  };

  const handleApiResponse = (data: { error?: string; response?: string }) => {
    if (data.error) {
      appendMessage('시스템', data.error);
    } else {
      return data.response;
    }
    return null;
  };

  const sendMessage = async () => {
    if (!userInput.trim() || isLoading) return;

    const userText = userInput.trim();
    appendMessage('교사', userText);
    setUserInput('');
    setIsLoading(true);

    const currentHistory = [...conversationHistory, { role: '교사' as const, text: userText }];

    if (counselingTurnsLeft <= 1) {
      setCounselingTurnsLeft(0);
      endCounseling(currentHistory);
      return;
    }

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getCounselingResponse',
          teacherInput: userText,
          history: currentHistory,
          topic: counselingTopic,
        }),
      });
      const data = await res.json();
      const studentResponse = handleApiResponse(data);
      if (studentResponse) {
        appendMessage('학생', studentResponse);
        setCounselingTurnsLeft(counselingTurnsLeft - 1);
      }
    } catch (error: unknown) {
      appendMessage('시스템', `오류: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const endCounseling = async (finalHistory: Turn[]) => {
    setCounselingEnded(true);
    appendMessage('시스템', '상담 턴이 모두 종료되었습니다. 학생의 최종 반응을 기다리는 중입니다...');
    setIsLoading(true);

    try {
      const studentReactionRes = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getStudentFinalReaction',
          fullConversation: finalHistory,
          topic: counselingTopic,
        }),
      });
      const studentReactionData = await studentReactionRes.json();
      const studentReactionText = handleApiResponse(studentReactionData);

      if (studentReactionText) {
        appendMessage('학생 (최종 반응)', studentReactionText);
        appendMessage('시스템', '이제 선생님의 상담 역량을 평가합니다. 잠시만 기다려주세요...');

        const teacherEvalRes = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getTeacherEvaluation',
            fullConversation: finalHistory.concat([{ role: '학생 (최종 반응)', text: studentReactionText }]),
            topic: counselingTopic,
          }),
        });
        const teacherEvalData = await teacherEvalRes.json();
        const teacherEvaluationText = handleApiResponse(teacherEvalData);
        if (teacherEvaluationText) {
          const htmlResult = teacherEvaluationText
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/^\* (.*$)/gim, '<ul><li>$1</li></ul>')
            .replace(/<\/ul>\n<ul>/g, '')
            .replace(/---/g, '<hr>')
            .replace(/\n/g, '<br>');
          setTeacherEvaluationResult(htmlResult);
        }
      }
    } catch (error: unknown) {
      appendMessage('시스템', `오류: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="topic-box">
        <h2>상담 시뮬레이션: 극단적 이기주의 학생편</h2>
        <p className="scenario">
          <strong>상황 제시:</strong> 당신은 중학교 교사입니다. 최근 학교 규칙을 상습적으로 위반하고, 친구들에게 피해를 주면서도 전혀 죄책감을 느끼지 않는 학생 &apos;김이득&apos;과 상담을 진행해야 합니다. 김이득은 &apos;들키지 않으면 괜찮다. 나에게 이득이 되는 것이 최고다&apos;라는 가치관을 가지고 있습니다.
        </p>
        <p><strong>상담 목표:</strong> 학생의 비합리적 신념에 균열을 내고, 관계의 중요성을 일깨워주며, 행동 변화의 작은 계기를 마련하는 것.</p>
      </div>

      {!counselingStarted && (
        <div id="setup">
          <p>상담 시작 버튼을 누르면 학생(AI)과의 상담이 시작됩니다. 총 5턴 동안 학생을 상담해보세요.</p>
          <div className="stance-buttons">
            <button onClick={startCounseling}>상담 시작</button>
          </div>
        </div>
      )}

      {counselingStarted && !teacherEvaluationResult && (
        <div id="debate-area">
          <div className="status-bar">
            <span>남은 턴: <span id="turnCounter">{counselingTurnsLeft}</span></span>
          </div>
          <div id="chatbox" ref={chatboxRef}>
            {conversationHistory.map((turn, index) => (
              <div key={index} className={`message ${
                turn.role === '교사' ? 'teacher-message' : 
                turn.role === '시스템' ? 'system-message' : 'student-message'
              }`}>
                <strong>{turn.role}:</strong><br />
                {turn.text.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}
              </div>
            ))}
          </div>
          <div className="input-area">
            <input
              type="text"
              id="userInput"
              placeholder={counselingEnded ? "상담이 종료되었습니다." : "학생에게 말할 내용을 입력하세요..."}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              disabled={isLoading || counselingEnded}
            />
            <button id="sendButton" onClick={sendMessage} disabled={isLoading || counselingEnded}>
              {isLoading ? '...' : '전송'}
            </button>
          </div>
        </div>
      )}

      {teacherEvaluationResult && (
        <div id="result-area" dangerouslySetInnerHTML={{ __html: teacherEvaluationResult }} />
      )}
    </div>
  );
}