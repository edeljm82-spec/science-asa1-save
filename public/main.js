import { achievementData, questionTemplates } from './data.js';
import { inquiryActivities } from './data1.js';

// === [여기서부터 아래 변수들까지 통째로 복사해서 기존 import 아래에 붙여넣기] ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 선생님의 Firebase 프로젝트 정보
const firebaseConfig = {
  apiKey: "AIzaSyDV_er1ecvJ6ll_6nqiHe10W7nX6kvEyt4",
  authDomain: "science-asa1-13844073-164bb.firebaseapp.com",
  projectId: "science-asa1-13844073-164bb",
  storageBucket: "science-asa1-13844073-164bb.firebasestorage.app",
  messagingSenderId: "946177749957",
  appId: "1:946177749957:web:c3a98314a79871d219d1ac"
};

// Firebase 실행
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// 현재 로그인한 사용자와 API Key를 기억해둘 공간
export let currentUser = null; 
export let userApiKey = ""; 
// ==============================================================================


document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    renderAchievementDashboard();
    initAnalysis();
    initInquiry();   // 선생님이 만드셨던 출판사 칩 필터링 복구!
    initModal();     // 선생님이 만드셨던 팝업(모달) 기능 복구!
    initFirebaseAuth(); // [추가할 부분: 로그인 기능 활성화 명령어]
    if (window.lucide) lucide.createIcons();
});

// 1. Navigation Logic (원본 복구)
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn, .tab-button');
    const sections = document.querySelectorAll('.content-section, .tab-content');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            
            navButtons.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            btn.classList.add('active');
            const targetEl = document.querySelector(targetId) || document.getElementById(targetId.replace('#', ''));
            if (targetEl) targetEl.classList.add('active');
            
            if (targetId.includes('inquiry')) {
                renderInquiryActivities('전체');
            }
        });
    });
}

// 2. Modal Logic (원본 복구 - 문제 풀이는 팝업으로 예쁘게 뜹니다)
function initModal() {
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    }
}

window.openModal = function(content) {
    const overlay = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    if (body && overlay) {
        body.innerHTML = content;
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (window.lucide) lucide.createIcons();
    }
}

window.closeModal = function() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// 3. Dashboard Rendering (여기만 아코디언 방식으로 업그레이드!)
function renderAchievementDashboard() {
    const container = document.getElementById('unit-container') || document.getElementById('standards-container');
    if (!container) return;
    
    container.innerHTML = achievementData.map(unit => `
        <div class="unit-section" style="margin-bottom: 2.5rem;">
            <h3 style="font-size: 1.75rem; font-weight: 850; margin-bottom: 1.5rem; color: var(--text-main); border-bottom: 2px solid var(--border-color, #e2e8f0); padding-bottom: 0.5rem;">
                ${unit.unit}
            </h3>
            <div class="standards-list" style="display: flex; flex-direction: column; gap: 1rem;">
                ${unit.standards.map(s => `
                    <div class="standard-row" data-id="${s.id}" style="background: white; border-radius: 16px; border: 1px solid #e2e8f0; padding: 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: 0.3s;">
                        
                        <div class="std-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="toggleAccordion(this)">
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <div class="std-id-badge" style="background: #e0e7ff; color: #2563eb; padding: 0.5rem 1rem; border-radius: 8px; font-weight: bold;">${s.id}</div>
                                <div class="std-info"><h4 style="margin: 0; font-size: 1.1rem; color: #0f172a;">${s.description}</h4></div>
                            </div>
                            <div style="color: #2563eb; font-weight: bold; font-size: 1.2rem;">▼</div>
                        </div>
                        
                        <div class="std-levels" style="display: none; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed #e2e8f0;">
                            ${Object.entries(s.levels).map(([level, desc]) => `
                                <div class="level-card" style="padding: 1.2rem; margin-bottom: 0.5rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; cursor: pointer; transition: 0.2s;" onclick="showDiagnosticQuestion('${s.id}', '${level}')" onmouseover="this.style.borderColor='#2563eb'" onmouseout="this.style.borderColor='#e2e8f0'">
                                    <strong style="color: ${level === 'A' ? '#2563eb' : level === 'B' ? '#10b981' : level === 'C' ? '#f59e0b' : level === 'D' ? '#ef4444' : '#64748b'}; font-size: 1.1rem; display: block; margin-bottom: 0.4rem;">[${level} 수준]</strong>
                                    <span style="font-size: 0.95rem; color: #475569; line-height: 1.5; display: block;">${desc}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// 아코디언 토글 제어 함수 (하나 열면 다른 건 자동으로 닫힘)
window.toggleAccordion = function(element) {
    const row = element.closest('.standard-row');
    const levelsDiv = row.querySelector('.std-levels');
    const isCurrentlyOpen = levelsDiv.style.display === 'block';

    // 1. 모든 아코디언 닫기
    document.querySelectorAll('.std-levels').forEach(div => div.style.display = 'none');
    document.querySelectorAll('.standard-row').forEach(r => r.style.borderColor = '#e2e8f0');

    // 2. 방금 클릭한 것만 열기
    if (!isCurrentlyOpen) {
        levelsDiv.style.display = 'block';
        row.style.borderColor = '#2563eb'; // 활성화된 테두리 파란색 강조
    }
};

// 4. Diagnostic Question (수능형 보기 추가)
window.showDiagnosticQuestion = function(standardId, level) {
    const templates = questionTemplates[standardId] && questionTemplates[standardId][level];
    
    if (!templates || templates.length === 0) {
        alert('해당 수준의 판별 문항이 아직 준비되지 않았습니다. 데이터를 추가해주세요.');
        return;
    }

    const q = templates[Math.floor(Math.random() * templates.length)];

    let conditionsHtml = '';
    if (q.conditions && q.conditions.length > 0) {
        conditionsHtml = `
            <div class="csat-box" style="border: 2px solid #cbd5e1; padding: 1.5rem; margin: 1.5rem 0; background: #fff; border-radius: 8px;">
                <div style="font-weight: bold; margin-bottom: 1rem; text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">&lt;보 기&gt;</div>
                ${q.conditions.map(cond => `<div style="margin-bottom: 0.5rem; padding-left: 0.5rem;">${cond}</div>`).join('')}
            </div>
        `;
    }

    // [교체할 코드] SVG 코드를 인식하여 그림으로 변환해줍니다!
    let imageHtml = '';
    if (q.image) {
        if (q.image.trim().startsWith('<svg')) {
            imageHtml = `<div style="display: flex; justify-content: center; margin-bottom: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0); padding: 1.5rem; background: white;">${q.image}</div>`;
        } else {
            imageHtml = `<img src="${q.image}" style="max-width: 100%; margin-bottom: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0); display: block; margin: 0 auto;">`;
        }
    }

    const content = `
        <div class="question-container" style="padding: 1rem 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div class="std-id-badge" style="background: #e0e7ff; color: #2563eb; padding: 0.5rem 1rem; border-radius: 8px; font-weight: bold;">${standardId}</div>
                <div style="font-weight: 800; color: white; background: #f59e0b; padding: 0.5rem 1.5rem; border-radius: 99px;">수준 ${level} 판정 문항</div>
            </div>
            
            <h3 style="font-size: 1.3rem; font-weight: 700; margin-bottom: 1.5rem; line-height: 1.6; color: #0f172a;">${q.question}</h3>
            
            ${imageHtml}
            ${conditionsHtml}

            <div class="options-list" style="display: grid; gap: 0.75rem; margin-top: 1.5rem;">
                ${q.options.map((opt, idx) => `
                    <button class="option-btn" style="text-align: left; padding: 1rem 1.5rem; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 8px; cursor: pointer; font-size: 1.05rem; transition: 0.2s;" onclick="checkAnswer(this, ${idx}, ${q.answer}, '${q.levelReason ? q.levelReason.replace(/'/g, "\\'") : ''}')">
                        <span style="display: inline-block; width: 28px; height: 28px; background: white; border-radius: 50%; text-align: center; line-height: 28px; margin-right: 10px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">${idx + 1}</span>
                        ${opt}
                    </button>
                `).join('')}
            </div>
            
            <div id="feedback-area"></div>
            
            <div id="reason-area" style="display:none; margin-top: 1.5rem; padding: 1.5rem; background: #f8fafc; border-left: 5px solid #2563eb; border-radius: 0 8px 8px 0;">
                <strong style="color: #2563eb; display: block; margin-bottom: 0.5rem;">💡 판정 이유 및 해설</strong>
                <p id="reason-text" style="font-size: 0.95rem; line-height: 1.6; margin: 0; color: #333;"></p>
            </div>
        </div>
    `;
    
    openModal(content);
};

window.checkAnswer = function(btn, selected, correct, reason) {
    const buttons = document.querySelectorAll('.option-btn');
    buttons.forEach(b => {
        b.disabled = true;
        b.style.opacity = '0.6';
        b.style.cursor = 'default';
    });
    btn.style.opacity = '1';

    const feedbackArea = document.getElementById('feedback-area');
    const reasonArea = document.getElementById('reason-area');
    const reasonText = document.getElementById('reason-text');

    if (selected === correct) {
        btn.style.borderColor = '#22c55e';
        btn.style.backgroundColor = '#f0fdf4';
        feedbackArea.innerHTML = `
            <div style="background: #22c55e; color: white; padding: 1.5rem; border-radius: 12px; margin-top: 1.5rem; font-weight: bold; text-align: center; font-size: 1.1rem;">
                정답입니다! 👏 해당 수준을 잘 이해하고 계시네요.
            </div>
        `;
    } else {
        btn.style.borderColor = '#ef4444';
        btn.style.backgroundColor = '#fef2f2';
        buttons[correct].style.borderColor = '#22c55e';
        buttons[correct].style.backgroundColor = '#f0fdf4';
        buttons[correct].style.opacity = '1';
        feedbackArea.innerHTML = `
            <div style="background: #ef4444; color: white; padding: 1.5rem; border-radius: 12px; margin-top: 1.5rem; font-weight: bold; text-align: center; font-size: 1.1rem;">
                아쉽습니다. 정답은 ${correct + 1}번입니다. 🤔
            </div>
        `;
    }

    if (reason) {
        reasonText.innerText = reason;
        reasonArea.style.display = 'block';
    }
};

// 5. Inquiry Logic (원본 복구 - 출판사 필터링 칩 완벽 작동)
function initInquiry() {
    const chips = document.querySelectorAll('.pub-chip');
    if (chips.length === 0) return;
    
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            renderInquiryActivities(chip.textContent);
        });
    });
}

function renderInquiryActivities(filter = '전체') {
    const container = document.getElementById('inquiry-list') || document.getElementById('inquiry-container');
    if (!container) return;
    
    let html = '';
    inquiryActivities.forEach(activity => {
        let matchingPublishers = activity.publishers;
        
        if (filter !== '전체') {
            matchingPublishers = activity.publishers.filter(p => p.name.includes(filter));
        }
        
        if (matchingPublishers.length > 0) {
            html += `
                <div class="inquiry-card" style="background: white; border-radius: 16px; padding: 2rem; margin-bottom: 2rem; border-left: 5px solid #7c3aed; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <div style="margin-bottom: 1rem;">
                        <span class="std-id-badge" style="background: #f1f5f9; color: #475569; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.9rem; font-weight: bold;">${activity.standardId}</span>
                    </div>
                    <h4 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 0.5rem; color: #0f172a;">${activity.title}</h4>
                    <p style="font-size: 1rem; color: #64748b; margin-bottom: 1.5rem;">${activity.description || ''}</p>
                    
                    <div class="pub-list" style="display: grid; gap: 1rem;">
                        ${matchingPublishers.map(p => `
                            <div class="pub-item" style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 1.5rem; border-radius: 12px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                    <strong style="font-size: 1.1rem; color: #333;">📑 ${p.name}</strong>
                                    ${p.downloadLink ? `<a href="${p.downloadLink}" style="color: #2563eb; text-decoration: none; font-weight: 700; font-size: 0.9rem;">활동지 다운로드</a>` : ''}
                                </div>
                                <p style="font-size: 0.95rem; color: #475569; line-height: 1.6; margin-bottom: 1rem;">${p.content}</p>
                                <div style="background: white; padding: 0.8rem 1rem; border-radius: 8px; font-size: 0.85rem; border: 1px dashed #7c3aed; color: #6d28d9; font-weight: 600;">
                                    준비물: ${p.materials}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    });
    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

// 6. Analysis Logic (원본 복구)
// [수정할 코드: 기존 function initAnalysis() 전체를 아래 코드로 덮어쓰기]

function initAnalysis() {
    const analyzeBtn = document.getElementById('analyze-btn');
    const resultDiv = document.getElementById('analysis-result');
    const questionText = document.getElementById('question-text');

    if (!analyzeBtn) return;

    analyzeBtn.addEventListener('click', async () => {
        // 1. 로그인 확인
        if (!currentUser) {
            alert('AI 문항 분석을 사용하려면 먼저 우측 상단에서 구글 로그인을 해주세요.');
            return;
        }

        // 2. API 키 확인 (없으면 모달 띄우기)
        if (!userApiKey) {
            document.getElementById('api-modal-overlay').classList.add('active');
            return;
        }

        const text = questionText.value;
        if (!text.trim()) {
            alert('분석할 문항 내용을 입력해주세요.');
            return;
        }

        // 로딩 상태 표시
        analyzeBtn.disabled = true;
        analyzeBtn.style.backgroundColor = "#94a3b8";
        analyzeBtn.innerHTML = `<span style="display:inline-block; animation: spin 1s linear infinite;">⏳</span> AI가 문항을 분석 중입니다...`;
        resultDiv.style.display = 'none';

        try {
            // === [핵심] gemini-3-flash-preview 모델 API 호출 ===
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${userApiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `당신은 대한민국 고등학교 '통합과학' 교과목의 전문적인 평가 문항 분석 인공지능입니다.
                            다음 문항 내용을 분석하여, 어떤 단원에 속하는지, 매칭되는 성취기준(예: 10통과1-02-01)은 무엇인지, 
                            그리고 난이도(A, B, C, D, E 수준)와 그 판정 이유를 3~4문장으로 명확하게 분석해주세요.
                            결과는 반드시 아래 HTML 구조를 유지하여 반환해주세요 (마크다운 백틱 쓰지 마세요).

                            문항 내용: "${text}"

                            [출력 HTML 형식]
                            <div style="background: #f0fdf4; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px solid #bbf7d0;">
                                <p style="margin-bottom: 0.8rem;"><strong>분석 단원:</strong> [단원명 작성]</p>
                                <p style="margin-bottom: 0.8rem;"><strong>매칭 성취기준:</strong> <span style="background: white; padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid #bbf7d0;">[성취기준 코드 작성]</span></p>
                                <p style="margin-bottom: 0;"><strong>판정 성취수준:</strong> <strong style="color: #7c3aed; font-size: 1.1rem;">[A~E 수준]</strong></p>
                            </div>
                            <div style="background: white; padding: 1.5rem; border-radius: 12px; border: 1px solid #e2e8f0;">
                                <strong style="color: #475569; display: block; margin-bottom: 0.5rem;">[판정 이유]</strong>
                                <p style="line-height: 1.7; color: #333; margin: 0;">
                                    [판정 이유를 3~4문장으로 자세히 작성]
                                </p>
                            </div>`
                        }]
                    }]
                })
            });

            const data = await response.json();

            // 에러 처리 (API 키 오류 등)
            if (!response.ok) {
                throw new Error(data.error?.message || 'API 호출 중 오류가 발생했습니다. (API 키가 유효한지 확인해주세요.)');
            }

            // 분석 결과 렌더링
            const aiResultHtml = data.candidates[0].content.parts[0].text;
            
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `
                <div class="card" style="border: 2px solid #22c55e; background: white; border-radius: 24px; padding: 2.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); margin-top: 2rem;">
                    <h3 style="color: #22c55e; display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; font-size: 1.4rem; font-weight: 800;">
                        AI 상세 분석 결과
                    </h3>
                    ${aiResultHtml}
                </div>
            `;

        } catch (error) {
            console.error("Gemini API Error:", error);
            alert(`분석 실패: ${error.message}\nAPI 키를 다시 확인하시거나 할당량을 초과했는지 확인해주세요.`);
            // 실패 시 모달 다시 띄워주기
            document.getElementById('api-modal-overlay').classList.add('active');
        } finally {
            // 버튼 상태 원상복구
            analyzeBtn.disabled = false;
            analyzeBtn.style.backgroundColor = "var(--primary-color)";
            analyzeBtn.textContent = 'AI 문항 분석 시작';
        }
    });

    // (선택) 로딩 스피너 애니메이션용 CSS 동적 추가
    const style = document.createElement('style');
    style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
}
// === [추가할 코드: main.js 맨 아래 마지막 줄에 통째로 복사+붙여넣기] ===
function initFirebaseAuth() {
    const btnLogin = document.getElementById('btn-google-login');
    const btnLogout = document.getElementById('btn-logout');
    const userInfo = document.getElementById('user-info');
    const userNameDisplay = document.getElementById('user-name-display');
    
    const btnApiSetup = document.getElementById('btn-api-setup');
    const apiModalOverlay = document.getElementById('api-modal-overlay');
    const apiModalClose = document.getElementById('api-modal-close');
    const btnSaveApi = document.getElementById('btn-save-api');
    const apiKeyInput = document.getElementById('api-key-input');

    // 1. 로그인 상태 확인 및 DB에서 내 API Key 가져오기
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            btnLogin.style.display = 'none';
            userInfo.style.display = 'flex';
            userNameDisplay.textContent = `${user.displayName} 선생님`;
            
            // DB에서 키 가져오기
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().apiKey) {
                userApiKey = docSnap.data().apiKey;
                btnApiSetup.textContent = "API Key 수정";
            }
        } else {
            currentUser = null;
            userApiKey = "";
            btnLogin.style.display = 'block';
            userInfo.style.display = 'none';
        }
    });

    // 2. 버튼 이벤트 모음
    btnLogin.addEventListener('click', () => signInWithPopup(auth, provider));
    btnLogout.addEventListener('click', () => signOut(auth));
    
    btnApiSetup.addEventListener('click', () => {
        apiKeyInput.value = userApiKey; 
        apiModalOverlay.classList.add('active');
    });
    apiModalClose.addEventListener('click', () => apiModalOverlay.classList.remove('active'));

    // 3. API Key 안전하게 데이터베이스(Firestore)에 저장
    btnSaveApi.addEventListener('click', async () => {
        if (!currentUser) return;
        const newKey = apiKeyInput.value.trim();
        if (!newKey) {
            alert("API Key를 입력해주세요.");
            return;
        }
        
        btnSaveApi.textContent = "저장 중...";
        try {
            await setDoc(doc(db, "users", currentUser.uid), {
                apiKey: newKey,
                updatedAt: new Date()
            }, { merge: true }); // 기존 데이터 덮어쓰기 방지
            
            userApiKey = newKey;
            alert("개인 API Key가 데이터베이스에 안전하게 저장되었습니다!");
            apiModalOverlay.classList.remove('active');
            btnApiSetup.textContent = "API Key 수정";
        } catch (error) {
            alert("저장 실패: " + error.message);
        } finally {
            btnSaveApi.textContent = "저장하기";
        }
    });
}
// ====================================================================