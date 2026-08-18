// === Firebase 초기화 및 필수 모듈 세팅 ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// 👇 맨 끝에 getDocs, query, where를 추가했습니다.
// 👇 오프라인에서도 이전에 불러온 데이터를 볼 수 있도록 persistence 관련 모듈을 추가했습니다.
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc, getDoc, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDV_er1ecvJ6ll_6nqiHe10W7nX6kvEyt4",
  authDomain: "science-asa1-13844073-164bb.firebaseapp.com",
  projectId: "science-asa1-13844073-164bb",
  storageBucket: "science-asa1-13844073-164bb.firebasestorage.app",
  messagingSenderId: "946177749957",
  appId: "1:946177749957:web:c3a98314a79871d219d1ac"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// 오프라인 캐시(IndexedDB)를 켜서, 한 번 불러온 데이터는 인터넷이 없어도 기기에서 그대로 보이게 합니다.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
const provider = new GoogleAuthProvider();

window.db = db;
window.doc = doc;
window.setDoc = setDoc;
window.collection = collection;
window.addDoc = addDoc;
// 👇 새로 추가하는 부분 (DB 검색 함수들을 화면 전체에서 쓸 수 있게 연결)
window.getDocs = getDocs;
window.getDoc = getDoc;
window.query = query;
window.where = where;

export let currentUser = null; 
export let userApiKey = "";

// 💡 여기에 구글 앱스 스크립트 URL을 추가합니다!
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxfvmHBl6uHL2HF1hrzymFBX7QGXf10INSbqKyAh1Li543KwTOXUjFTcETwzfzMUejL/exec";

// 전역 변수
let selectedImageBase64 = null;
let selectedImageMimeType = null;
// [추가] 현재 분석 중인 문항의 최신 상태를 안전하게 보관하는 객체 (챗봇 연동용)
window.currentAnalysisState = {
    mainStd: "미분류",
    subStds: "",
    level: "A",
    isMCP: "X",
    question: "",
    conditions: [], 
    options: [],    
    answer: 0,
    svg: "",
    reason: ""
};

// HTML에서 데이터를 추출하여 상태 객체를 업데이트하는 안전한 헬퍼 함수
// 💡 SVG 안의 marker/gradient 등 id(및 그것을 가리키는 url(#id))가 다른 문항의 SVG와 겹치면,
// 브라우저는 문서 전체에서 처음 매칭되는 id를 사용해버려 화살표 등이 엉뚱하게(또는 안 보이게) 렌더링됩니다.
// 문항마다 고유한 접미사를 붙여 이 충돌을 원천적으로 막습니다.
let svgIdNamespaceCounter = 0;
function namespaceSvgIds(svgString) {
    const suffix = '-' + Date.now().toString(36) + '-' + (svgIdNamespaceCounter++);
    const ids = new Set();
    svgString.replace(/\bid="([^"]+)"/g, (m, id) => { ids.add(id); return m; });
    let result = svgString;
    ids.forEach(id => {
        const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const newId = id + suffix;
        result = result
            .replace(new RegExp(`id="${escaped}"`, 'g'), `id="${newId}"`)
            .replace(new RegExp(`url\\(#${escaped}\\)`, 'g'), `url(#${newId})`)
            .replace(new RegExp(`href="#${escaped}"`, 'g'), `href="#${newId}"`);
    });
    return result;
}

window.extractDataToState = function(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    
    // 💡 innerText는 DOMParser로 만든(화면에 붙지 않은) 문서에서는 레이아웃이 없어 빈 값을 반환할 수 있으므로,
    // 레이아웃과 무관하게 항상 안정적으로 동작하는 textContent를 사용합니다.
    const getText = (id) => doc.getElementById(id) ? doc.getElementById(id).textContent.trim() : null;
    const getHtml = (id) => doc.getElementById(id) ? doc.getElementById(id).innerHTML.trim() : null;
    
    if (getText('ai-main-std')) window.currentAnalysisState.mainStd = getText('ai-main-std');
    if (getText('ai-sub-stds')) window.currentAnalysisState.subStds = getText('ai-sub-stds');
    if (getText('ai-level')) window.currentAnalysisState.level = getText('ai-level');
    if (getText('ai-is-mcp')) window.currentAnalysisState.isMCP = getText('ai-is-mcp');
    if (getText('ai-modified-question')) window.currentAnalysisState.question = getText('ai-modified-question');
    
    // 💡 ai-cond-1(제시문)에는 <table> 등 HTML 구조가 들어있을 수 있으므로,
    // 텍스트만 남기는 getText 대신 마크업을 보존하는 getHtml로 추출합니다.
    const conds = [];
    for(let i=1; i<=5; i++) {
        const html = getHtml(`ai-cond-${i}`);
        if (html && html.trim() !== '') conds.push(html);
    }
    window.currentAnalysisState.conditions = conds;

    const opts = [];
    if (getText('ai-opt-1')) opts.push(getText('ai-opt-1'));
    if (getText('ai-opt-2')) opts.push(getText('ai-opt-2'));
    if (getText('ai-opt-3')) opts.push(getText('ai-opt-3'));
    if (getText('ai-opt-4')) opts.push(getText('ai-opt-4'));
    if (getText('ai-opt-5')) opts.push(getText('ai-opt-5'));

    if (opts.length === 5) {
        window.currentAnalysisState.options = opts;
    } else {
        // 💡 [1차 안전장치] id(ai-opt-N)로 못 찾은 경우, '정답' 표시 직전에 나온 ①~⑤ 기호를 기준으로
        // 본문 텍스트에서 직접 선지 내용을 복구합니다. (AI가 가끔 id 속성을 누락하는 경우 대비)
        const bodyText = (doc.body ? doc.body.textContent : htmlString).replace(/\s+/g, ' ');
        const markers = ['①', '②', '③', '④', '⑤'];
        const answerIdx = bodyText.indexOf('정답');
        const zone = answerIdx !== -1 ? bodyText.slice(0, answerIdx) : bodyText;
        const positions = markers.map(m => zone.lastIndexOf(m));
        const inOrder = positions.every((p, i) => p !== -1 && (i === 0 || p > positions[i - 1]));

        let recovered = null;
        if (inOrder) {
            const candidate = positions.map((pos, i) => {
                const start = pos + 1;
                const end = i < 4 ? positions[i + 1] : zone.length;
                return zone.slice(start, end).trim();
            });
            if (candidate.every(t => t.length > 0)) recovered = candidate;
        }

        // 💡 [2차 안전장치] 위 두 방법 모두 DOM 파싱 결과(doc)에 의존하는데, 응답 어딘가의
        // 이스케이프되지 않은 문자 하나 때문에 DOM 트리 자체가 깨지면 둘 다 실패할 수 있습니다.
        // 이 경우 DOM 파싱을 아예 거치지 않고, 원본 텍스트(htmlString)에서 정규식으로
        // id="ai-opt-N" 뒤에 오는 내용을 직접 긁어옵니다.
        if (!recovered) {
            const regexRecovered = [];
            for (let i = 1; i <= 5; i++) {
                const m = htmlString.match(new RegExp(`id=["']ai-opt-${i}["'][^>]*>([^<]*)<`));
                regexRecovered.push(m ? m[1].trim() : '');
            }
            if (regexRecovered.every(t => t.length > 0)) recovered = regexRecovered;
        }

        if (recovered) {
            window.currentAnalysisState.options = recovered;
        } else {
            // 복구도 실패하면, 혼동을 막기 위해 진짜 선지처럼 보이지 않는 명확한 오류 문구로 표시합니다.
            console.error("선지 추출 실패. 원본 htmlContent:", htmlString);
            window.currentAnalysisState.options = ["⚠️ 선지 인식 실패 (문항 재생성 필요)", "⚠️ 선지 인식 실패 (문항 재생성 필요)", "⚠️ 선지 인식 실패 (문항 재생성 필요)", "⚠️ 선지 인식 실패 (문항 재생성 필요)", "⚠️ 선지 인식 실패 (문항 재생성 필요)"];
            // 💡 원인 분석용: 실패한 원본 응답을 기록해둡니다(로그인 상태에서만, 실패해도 무시).
            try {
                if (window.db && typeof collection === 'function' && currentUser) {
                    addDoc(collection(window.db, "debug_extraction_failures"), {
                        html: htmlString,
                        createdAt: new Date(),
                        authorUid: currentUser.uid
                    }).catch(() => {});
                }
            } catch (e) { /* 디버그 기록 실패는 무시 */ }
        }
    }

    if (getHtml('ai-reason-text')) window.currentAnalysisState.reason = getHtml('ai-reason-text');
    
    const ansRaw = getText('ai-modified-answer');
    if (ansRaw) {
        const num = parseInt(ansRaw.replace(/[^0-9]/g, ''));
        if (!isNaN(num)) window.currentAnalysisState.answer = num - 1; 
    }

    const svgContainer = doc.getElementById('ai-modified-svg');
    if (svgContainer && svgContainer.innerHTML.includes('<svg')) {
        window.currentAnalysisState.svg = namespaceSvgIds(svgContainer.innerHTML.trim());
    } else {
        // 💡 이 문항에는 그림이 없는데, 직전에 생성했던 다른 문항의 svg가 상태에 그대로 남아
        // 이번 문항에 잘못 붙어 저장되는 것을 막기 위해 명시적으로 비웁니다.
        window.currentAnalysisState.svg = '';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    
    // 💡 [수정됨] HTML의 선택창(course-select)에 설정된 기본값을 직접 읽어와서 첫 화면을 그립니다.
    const courseSelect = document.getElementById('course-select');
    const initialCourse = courseSelect ? courseSelect.value : "1. 통합과학1";
    renderAchievementDashboard(initialCourse);

    // 💡 [수정됨] 드롭다운 변경 이벤트도 이곳으로 깔끔하게 통합합니다.
    if (courseSelect) {
        courseSelect.addEventListener('change', (e) => {
            renderAchievementDashboard(e.target.value);
        });
    }

    initAnalysis();
    //initQuestionCreation(); // ✅ 주석 처리하여 실행을 막습니다.
    initInquiry();   
    initModal();     
    initFirebaseAuth(); 
    if (window.lucide) lucide.createIcons();
    initChatbotResize();
    
    window.initCreationDB(); 
    window.selectType('general'); 
});

// 1. Navigation Logic
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

// 2. Modal Logic
function initModal() {
    // 기존 기본 모달 닫기
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    }

    // 💡 [수정됨] DB 저장 팝업창 닫기 기능 추가
    const saveModalOverlay = document.getElementById('save-modal-overlay');
    // X 버튼 (클래스가 close-btn이거나 id가 save-modal-close인 요소 찾기)
    const saveModalCloseBtn = document.querySelector('#save-modal-overlay .close-btn') || document.getElementById('save-modal-close');
    
    if (saveModalCloseBtn) {
        saveModalCloseBtn.addEventListener('click', () => {
            if (saveModalOverlay) saveModalOverlay.classList.remove('active');
        });
    }
    // 배경(어두운 부분) 클릭 시 닫기
    if (saveModalOverlay) {
        saveModalOverlay.addEventListener('click', (e) => {
            if (e.target === saveModalOverlay) saveModalOverlay.classList.remove('active');
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

// 3. Dashboard Rendering (기존 함수를 찾아 아래 내용으로 완전히 덮어쓰세요)
async function renderAchievementDashboard(selectedCourse = "1. 통합과학1") {
    const container = document.getElementById('unit-container') || document.getElementById('standards-container');
    if (!container) return;
    
    // 💡 [안전장치 추가] 혹시라도 값이 비어있다면 드롭다운 값을 다시 확인합니다.
    if (!selectedCourse) {
        const selectElem = document.getElementById('course-select');
        selectedCourse = selectElem ? selectElem.value : "1. 통합과학1"; // 최후의 보루
    }
    
    // 데이터를 불러오는 동안 보여줄 로딩 메시지
    container.innerHTML = '<div style="text-align:center; padding: 3rem; font-size: 1.2rem; color: #64748b;">데이터베이스에서 성취기준을 불러오는 중입니다... ⏳</div>';

    try {
        // 파이어베이스에서 선택된 과목(selectedCourse)의 데이터만 쏙 뽑아옵니다.
        const q = query(collection(db, "standards"), where("course", "==", selectedCourse));
        const querySnapshot = await getDocs(q);
        
        const standardsData = [];
        querySnapshot.forEach((doc) => {
            standardsData.push(doc.data());
        });

        // 💡 [핵심 수정!] 파이어베이스에서 가져온 데이터를 AI가 읽을 수 있도록 메모리(전역 변수)에 저장합니다!
        window.cachedStandards = standardsData;

        if (standardsData.length === 0) {
            // 💡 [수정] 네트워크가 없어서 못 가져온 것인지, 진짜로 등록된 데이터가 없는 것인지 구분해서 안내합니다.
            if (!navigator.onLine || querySnapshot.metadata.fromCache) {
                container.innerHTML = '<div style="text-align:center; padding: 3rem; color: #ef4444;">인터넷 연결이 없어 성취기준 데이터를 불러올 수 없습니다.<br>와이파이 또는 데이터 연결을 확인한 후 새로고침해주세요.</div>';
            } else {
                container.innerHTML = '<div style="text-align:center; padding: 3rem; color: #ef4444;">등록된 성취기준 데이터가 없습니다.</div>';
            }
            return;
        }

        // 단원명(unit)을 기준으로 데이터를 묶어줍니다.
        const groupedData = {};
        standardsData.forEach(std => {
            if (!groupedData[std.unit]) {
                groupedData[std.unit] = { unit: std.unit, standards: [] };
            }
            groupedData[std.unit].standards.push(std);
        });

        // 단원명 순서, 그리고 성취기준 코드(id) 순으로 예쁘게 정렬합니다.
        const filteredData = Object.values(groupedData).sort((a, b) => a.unit.localeCompare(b.unit));
        filteredData.forEach(group => {
            group.standards.sort((a, b) => a.standardId.localeCompare(b.standardId));
        });

        // 화면에 HTML 그리기
        let html = '';
        html += filteredData.map(unit => `
            <div class="unit-section" style="margin-bottom: 2.5rem;">
                <h3 style="font-size: 1.75rem; font-weight: 850; margin-bottom: 1.5rem; color: var(--text-main); border-bottom: 2px solid var(--border-color, #e2e8f0); padding-bottom: 0.5rem;">
                    ${unit.unit}
                </h3>
                <div class="standards-list" style="display: flex; flex-direction: column; gap: 1rem;">
                    ${unit.standards.map(s => `
                        <div class="standard-row" data-id="${s.standardId}" style="background: white; border-radius: 16px; border: 1px solid #e2e8f0; padding: 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: 0.3s;">
                            
                            <div class="std-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="toggleAccordion(this)">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <div class="std-id-badge" style="background: #e0e7ff; color: #2563eb; padding: 0.5rem 1rem; border-radius: 8px; font-weight: bold; white-space: nowrap; flex-shrink: 0; width: 140px; text-align: center;">${s.standardId}</div>
                                    <div class="std-info"><h4 style="margin: 0; font-size: 1.1rem; color: #0f172a;">${s.description}</h4></div>
                                </div>
                                <div style="color: #2563eb; font-weight: bold; font-size: 1.2rem;">▼</div>
                            </div>
                            
                            <div class="std-levels" style="display: none; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed #e2e8f0;">
                                ${Object.entries(s.levels).sort((a, b) => a[0].localeCompare(b[0])).map(([level, desc]) => `
                                    <div class="level-card" style="padding: 1.2rem; margin-bottom: 0.5rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; cursor: pointer; transition: 0.2s;" onclick="showDiagnosticQuestion('${s.standardId}', '${level}')" onmouseover="this.style.borderColor='#2563eb'" onmouseout="this.style.borderColor='#e2e8f0'">
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
        
        container.innerHTML = html;
    } catch (error) {
        console.error("화면 그리기 실패:", error);
        container.innerHTML = '<div style="text-align:center; padding: 3rem; color: #ef4444;">데이터를 불러오는 중 오류가 발생했습니다.</div>';
    }
}



window.toggleAccordion = function(element) {
    const row = element.closest('.standard-row');
    const levelsDiv = row.querySelector('.std-levels');
    const isCurrentlyOpen = levelsDiv.style.display === 'block';

    document.querySelectorAll('.std-levels').forEach(div => div.style.display = 'none');
    document.querySelectorAll('.standard-row').forEach(r => r.style.borderColor = '#e2e8f0');

    if (!isCurrentlyOpen) {
        levelsDiv.style.display = 'block';
        row.style.borderColor = '#2563eb'; 
    }
};

// ====================================================================
// [수정] 4. Diagnostic Question (여러 문항 넘겨보기 기능 추가)
// ====================================================================

// 현재 불러온 문항 목록과 인덱스를 기억할 변수
let currentQuestionsList = [];
let currentQuestionIndex = 0;

window.showDiagnosticQuestion = async function(standardId, level) {
    // 로딩 모달을 먼저 띄워줍니다.
    openModal('<div style="text-align:center; padding: 4rem; font-size: 1.2rem;">문항을 불러오는 중입니다... ⏳</div>');

    try {
        // 💡 [핵심 수정] 복합 색인(Index) 에러를 피하기 위해 파이어베이스에서는 '성취기준(standardId)' 하나로만 검색해서 가져옵니다.
        const qRef = collection(db, "questions");
        const qQuery = query(qRef, where("standardId", "==", standardId));
        const querySnapshot = await getDocs(qQuery);

        const templates = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // 💡 [핵심 수정] 가져온 데이터 뭉치 중에서 자바스크립트로 한 번 더 '성취수준(level)'을 걸러냅니다.
            if (data.level === level) {
                templates.push(data);
            }
        });
        
        if (templates.length === 0) {
            const emptyHtml = `
                <div style="text-align:center; padding: 3rem;">
                    <h3 style="color: #ef4444; margin-bottom: 1rem;">준비된 문항이 없습니다.</h3>
                    <p style="color: #64748b;">[${standardId}]의 [${level}] 수준에 해당하는 판별 문항을 아직 DB에 등록하지 않으셨습니다.</p>
                </div>
            `;
            document.getElementById('modal-body').innerHTML = emptyHtml;
            return;
        }

        // 찾아낸 문항 목록을 변수에 저장하고 첫 번째 문항(index 0)부터 보여줍니다.
        currentQuestionsList = templates;
        currentQuestionIndex = 0;
        
        window.renderCurrentQuestion(standardId, level);

    } catch (error) {
        console.error("문항 불러오기 에러:", error);
        document.getElementById('modal-body').innerHTML = '<div style="text-align:center; padding: 3rem; color: #ef4444;">문항을 불러오지 못했습니다.</div>';
    }
};

// 💡 conditions 배열 안에는 제시문(표/자료 등, ai-cond-1)과 <보기> ㄱ,ㄴ,ㄷ 항목(ai-cond-2~4)이
// 순서대로 섞여 들어옵니다. 둘을 구분해 AI문항제작 탭 미리보기와 같은 모양(제시문 → 구분선 → <보기>)으로
// 렌더링할 수 있도록, ㄱ/ㄴ/ㄷ(또는 가/나/다) 기호로 시작하는 항목만 "보기"로 분류합니다.
function splitConditions(conditions) {
    const bogiRe = /^\s*[ㄱㄴㄷㄹㅁ가나다라마]\.\s?/;
    const presentation = [];
    const bogi = [];
    (conditions || []).forEach(c => {
        if (bogiRe.test(c)) bogi.push(c); else presentation.push(c);
    });
    return { presentation, bogi };
}

// 선택된 인덱스의 문항을 화면에 그리는 함수
window.renderCurrentQuestion = function(standardId, level) {
    const q = currentQuestionsList[currentQuestionIndex];
    const totalQuestions = currentQuestionsList.length;

    // 제시문(표 등)과 <보기> ㄱ,ㄴ,ㄷ을 구분해서 표시
    let conditionsHtml = '';
    if (q.conditions && q.conditions.length > 0) {
        const { presentation, bogi } = splitConditions(q.conditions);
        conditionsHtml = `
            <div class="csat-box" style="border: 1px solid #cbd5e1; padding: 0.8rem 1rem; margin: 0.8rem 0; background: #f8fafc; border-radius: 6px;">
                ${presentation.length > 0 ? `
                    <div style="${bogi.length > 0 ? 'margin-bottom: 0.8rem; padding-bottom: 0.8rem; border-bottom: 1px dashed #cbd5e1;' : ''} line-height: 1.5;">
                        ${presentation.map(p => `<div style="margin-bottom: 0.5rem;">${p}</div>`).join('')}
                    </div>
                ` : ''}
                ${bogi.length > 0 ? `
                    <div style="font-weight: bold; margin-bottom: 0.5rem; text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3rem; font-size: 0.9rem;">&lt;보 기&gt;</div>
                    ${bogi.map(cond => `<div style="margin-bottom: 0.5rem; line-height: 1.5;">${cond}</div>`).join('')}
                ` : ''}
            </div>
        `;
    }

    // 이미지 처리
    let imageHtml = '';
    if (q.svgImage || q.image || q.imageUrl) {
        const imgSrc = q.svgImage || q.image || q.imageUrl;
        if (imgSrc.trim().startsWith('<svg')) {
            imageHtml = `<div style="display: flex; justify-content: center; margin-bottom: 0.8rem; border-radius: 6px; border: 1px solid var(--border-color, #e2e8f0); padding: 0.5rem; background: white; max-height: 250px; overflow: hidden;">${imgSrc}</div>`;
        } else {
            imageHtml = `<img src="${imgSrc}" style="max-height: 250px; width: auto; max-width: 100%; margin-bottom: 0.8rem; border-radius: 6px; border: 1px solid var(--border-color, #e2e8f0); display: block; margin: 0 auto; object-fit: contain;">`;
        }
    }

    // 💡 이전/다음 버튼 생성 로직 (문항이 2개 이상일 때만 표시)
    let navButtonsHtml = '';
    if (totalQuestions > 1) {
        navButtonsHtml = `
            <div style="display: flex; gap: 6px; align-items: center; background: #f1f5f9; padding: 3px 6px; border-radius: 99px;">
                <button onclick="prevQuestion('${standardId}', '${level}')" style="background: transparent; color: #475569; border: none; padding: 0.2rem 0.5rem; border-radius: 99px; font-weight: bold; font-size: 0.85rem; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#e2e8f0'; this.style.color='#0f172a'" onmouseout="this.style.background='transparent'; this.style.color='#475569'">
                    ⬅️ 이전
                </button>
                <span style="font-size: 0.8rem; font-weight: bold; color: #64748b;">${currentQuestionIndex + 1}/${totalQuestions}</span>
                <button onclick="nextQuestion('${standardId}', '${level}')" style="background: transparent; color: #475569; border: none; padding: 0.2rem 0.5rem; border-radius: 99px; font-weight: bold; font-size: 0.85rem; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#e2e8f0'; this.style.color='#0f172a'" onmouseout="this.style.background='transparent'; this.style.color='#475569'">
                    다음 ➡️
                </button>
            </div>
        `;
    }

    // 전체 레이아웃 (헤더 영역을 두 줄로 나누어 공간을 여유롭게 배치)
    const content = `
        <div class="question-container" style="padding: 0.5rem 1rem;">
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
                <div class="std-id-badge" style="background: #e0e7ff; color: #2563eb; padding: 0.3rem 0.6rem; border-radius: 6px; font-weight: bold; font-size: 0.9rem;">${standardId}</div>
                ${navButtonsHtml}
            </div>

            <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-bottom: 1rem; padding-bottom: 0.6rem; border-bottom: 1px solid #f1f5f9;">
                ${q.isMCP === true ? `<div style="font-weight: 800; color: white; background: #ef4444; padding: 0.3rem 0.8rem; border-radius: 99px; font-size: 0.85rem; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);">🎯 MCP 문항</div>` : ''}
                <div style="font-weight: 800; color: white; background: #f59e0b; padding: 0.3rem 0.8rem; border-radius: 99px; font-size: 0.85rem;">수준 ${level} 판정</div>
            </div>
            
            <h3 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.8rem; line-height: 1.4; color: #0f172a;">${q.question}</h3>
            
            ${imageHtml}
            ${conditionsHtml}

            <div class="options-list" style="display: grid; gap: 0.4rem; margin-top: 0.8rem;">
                ${(q.options || []).map((opt, idx) => `
                    <button class="option-btn" style="text-align: left; padding: 0.6rem 1rem; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 6px; cursor: pointer; font-size: 0.9rem; transition: 0.2s; display: flex; align-items: center;" onclick="checkAnswer(this, ${idx}, ${q.answer})">
                        <span style="display: inline-block; width: 22px; height: 22px; background: white; border-radius: 50%; text-align: center; line-height: 22px; margin-right: 8px; font-weight: bold; font-size: 0.8rem; box-shadow: 0 1px 2px rgba(0,0,0,0.1); flex-shrink: 0;">${idx + 1}</span>
                        <span>${opt}</span>
                    </button>
                `).join('')}
            </div>
            
            <div id="feedback-area"></div>
            
            <div id="reason-area" style="display:none; margin-top: 1rem; padding: 1rem; background: #f8fafc; border-left: 4px solid #2563eb; border-radius: 0 6px 6px 0;">
                <strong style="color: #2563eb; display: block; margin-bottom: 0.3rem; font-size: 0.9rem;">💡 판정 이유 및 해설</strong>
                <p id="reason-text" style="font-size: 0.85rem; line-height: 1.5; margin: 0; color: #475569; max-height: 120px; overflow-y: auto;"></p>
            </div>
        </div>
    `;
    
    document.getElementById('modal-body').innerHTML = content;

    if (window.MathJax) {
        MathJax.typesetPromise([document.getElementById('modal-body')]).catch((err) => console.error('MathJax 렌더링 에러:', err));
    }
};

// 💡 이전 버튼 기능 추가
window.prevQuestion = function(standardId, level) {
    currentQuestionIndex--; // 번호를 1 감소
    // 만약 첫 번째 문제에서 이전 버튼을 누르면 마지막 문제로 이동
    if (currentQuestionIndex < 0) {
        currentQuestionIndex = currentQuestionsList.length - 1; 
    }
    window.renderCurrentQuestion(standardId, level);
};

// 💡 다음 버튼 기능 유지
window.nextQuestion = function(standardId, level) {
    currentQuestionIndex++; 
    if (currentQuestionIndex >= currentQuestionsList.length) {
        currentQuestionIndex = 0; 
    }
    window.renderCurrentQuestion(standardId, level);
};

window.checkAnswer = function(btn, selected, correct) {
    // 👇 클릭한 순간 현재 문제의 해설(reason)을 직접 찾아옵니다!
    const q = currentQuestionsList[currentQuestionIndex];
    const reason = q.levelReason || q.aiReason || '해설이 제공되지 않았습니다.';

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
        // 1. innerText를 innerHTML로 변경하여 디자인 태그가 작동하게 만듭니다.
        reasonText.innerHTML = reason; 
        reasonArea.style.display = 'block';

        // 2. 해설이 화면에 뜬 직후, 수식 번역기(MathJax)를 이 구역에만 다시 실행합니다.
        if (window.MathJax) {
            MathJax.typesetPromise([reasonText]).catch((err) => console.error('MathJax 렌더링 에러:', err));
        }
    }
};

// 5. Inquiry Logic
// 💡 2022 개정 교육과정 공식 '필수탐구활동' 목록 (제목만 사용 - 저작권 문제 없음. 내용은 AI가 매번 새로 창작함)
const INQUIRY_TOPICS = {
    int1: {
        label: "통합과학1",
        units: [
            { name: "(1) 과학의 기초", topics: [
                "미시세계와 거시세계의 물체의 크기에 따른 차이점 분석하기",
                "일상생활에서 측정 표준이 활용되는 사례 탐색하기",
                "스마트 기기를 활용하여 여러 가지 기본량을 측정하고 분석하기"
            ]},
            { name: "(2) 물질과 규칙성", topics: [
                "분광기를 활용하여 다양한 물질이 방출하는 스펙트럼을 관찰·비교하기",
                "지구와 생명체의 구성 성분을 비교하여, 우주와 지구 역사를 통한 구성 성분의 유래 탐구하기",
                "같은 족 원소들의 유사성을 탐구하는 실험 설계하기",
                "이온 결합 화합물과 공유 결합 화합물의 성질을 비교하는 실험하기",
                "DNA 모형을 제작하고 DNA의 구조적 특징과 규칙성 탐구하기"
            ]},
            { name: "(3) 시스템과 상호작용", topics: [
                "화산 분출로 인한 환경·사회경제적 피해의 종류를 조사하고, 지구와 생명 시스템 측면에서 피해를 줄이기 위한 대책 수립하기",
                "자유 낙하와 수평으로 던진 물체의 운동을 시각화하여 비교하기",
                "교통수단과 스포츠 등에서 충격을 줄이는 방법 탐색하기",
                "막을 통한 물질의 이동을 실험하고 생명 활동 유지에서 세포막의 역할 탐구하기",
                "효소 작용의 원리에 관한 실험하기"
            ]}
        ]
    },
    int2: {
        label: "통합과학2",
        units: [
            { name: "(1) 변화와 다양성", topics: [
                "생물 대멸종의 원인과 그 이후의 변화를 설명하는 여러 가설들의 타당성 평가하기",
                "자연선택 과정에 대한 모의실험하기",
                "산과 염기를 혼합할 때 용액의 온도를 측정하여 그래프로 나타내기",
                "가열장치 없이 물과 산화 칼슘을 이용한 음식 조리 방법 설계하고 실험하기"
            ]},
            { name: "(2) 환경과 에너지", topics: [
                "개체군 변동 모의실험하기",
                "지구온난화에 따른 지구 열수지 변동 탐구하기",
                "기후변화로 인한 생태계와 지구계의 미래 시나리오 구상하기",
                "자석과 코일의 상대 운동에 의해 운동 에너지가 전기 에너지로 전환되는 과정 탐구하기"
            ]},
            { name: "(3) 과학과 미래 사회", topics: [
                "핵산과 단백질을 이용한 감염병 진단 기술 체험하기",
                "디지털 탐구 도구를 활용한 실시간 생활 데이터 측정하기",
                "일상생활에 활용되는 로봇의 특징 분석 및 개선방안 고안하기"
            ]}
        ]
    },
    life: {
        label: "생명과학",
        units: [
            { name: "(1) 생명시스템의 구성", topics: [
                "소화제와 소화 효소를 이용한 영양소 분해 실험하기",
                "방형구법으로 식물 군집 분석하기"
            ]},
            { name: "(2) 항상성과 몸의 조절", topics: [
                "실감형 콘텐츠를 활용한 뇌 구조 탐구하기",
                "스마트 헬스케어를 활용한 항상성 유지 작용 탐구하기",
                "혈액형 검사를 통해 혈액형 판별하기"
            ]},
            { name: "(3) 생명의 연속성과 다양성", topics: [
                "염색체 모형을 이용한 핵형 분석하기",
                "생식세포 형성과정을 창의적인 모델로 제작하기",
                "온라인 식물도감 만들기",
                "생물 분류 프로그래밍을 이용하여 계통수 작성하기"
            ]}
        ]
    },
    cellmeta: {
        label: "세포와 물질대사",
        units: [
            { name: "(1) 세포", topics: [
                "핵산과 단백질의 모형 제작하기",
                "현미경을 이용하여 세포의 크기 측정하기",
                "간이 원심분리기구 제작하기",
                "세포에서 삼투현상 관찰하기"
            ]},
            { name: "(2) 물질대사와 에너지", topics: [
                "1일 칼로리 섭취량과 소비량 조사하여 에너지 섭취량과 소비량 비교하기",
                "발아 중인 콩의 물질대사와 에너지대사 탐구하기"
            ]},
            { name: "(3) 세포호흡과 광합성", topics: [
                "미토콘드리아와 엽록체 내부구조 모형 제작하기",
                "발효 실험 설계하여 수행하기",
                "크로마토그래피로 식물의 잎에서 광합성 색소 분리하기"
            ]}
        ]
    },
    heredity: {
        label: "생물의 유전",
        units: [
            { name: "(1) 유전자와 유전물질", topics: [
                "가계도 분석하기",
                "DNA를 추출하여 관찰하기",
                "DNA 복제 모의실험하기"
            ]},
            { name: "(2) 유전자의 발현", topics: [
                "단백질 합성 과정 모의실험하기"
            ]},
            { name: "(3) 생명공학기술", topics: [
                "단백질 화합물 상호작용 가상 실험하기"
            ]}
        ]
    }
};

let currentInquiryCourse = 'int1';

function initInquiry() {
    const selectContainer = document.getElementById('inquiry-course-select');
    if (!selectContainer) return;

    selectContainer.innerHTML = Object.keys(INQUIRY_TOPICS).map(key => `
        <button class="inquiry-course-btn" data-course="${key}" style="padding: 0.7rem 1.3rem; border-radius: 8px; border: 2px solid ${key === currentInquiryCourse ? '#2563eb' : '#cbd5e1'}; background: ${key === currentInquiryCourse ? '#2563eb' : '#f8fafc'}; color: ${key === currentInquiryCourse ? 'white' : '#1e3a8a'}; font-weight: bold; cursor: pointer; transition: 0.2s;">
            ${INQUIRY_TOPICS[key].label}
        </button>
    `).join('');

    selectContainer.querySelectorAll('.inquiry-course-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentInquiryCourse = btn.dataset.course;
            initInquiry();
            renderInquiryUnits(currentInquiryCourse);
        });
    });

    renderInquiryUnits(currentInquiryCourse);
}

// 나브 클릭 시 다시 호출되는 진입점 (initNavigation에서 호출)
function renderInquiryActivities() {
    renderInquiryUnits(currentInquiryCourse);
}

function renderInquiryUnits(courseKey) {
    const container = document.getElementById('inquiry-container');
    if (!container) return;

    const course = INQUIRY_TOPICS[courseKey];
    if (!course) { container.innerHTML = ''; return; }

    container.innerHTML = course.units.map((unit, unitIdx) => `
        <div class="inquiry-unit-section" style="margin-bottom: 2rem;">
            <h3 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 1rem; color: var(--text-main); border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem;">${unit.name}</h3>
            <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                ${unit.topics.map((topic, topicIdx) => `
                    <button class="inquiry-topic-btn" onclick="window.showInquiryActivity('${courseKey}', ${unitIdx}, ${topicIdx})" style="text-align: left; padding: 1rem 1.2rem; background: white; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; font-size: 0.98rem; color: #1e293b; box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: 0.2s;" onmouseover="this.style.borderColor='#2563eb'" onmouseout="this.style.borderColor='#e2e8f0'">
                        🔬 ${topic}
                    </button>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function inquiryDocId(courseKey, unitIdx, topicIdx, variant = 1) {
    const base = `${courseKey}-${unitIdx + 1}-${topicIdx + 1}`;
    return variant > 1 ? `${base}-${variant}` : base;
}

// 주제 하나에 딸린 활동지 세트를 변형 번호(1, 2, 3...) 순서로 존재하는 만큼 모두 불러옵니다.
async function loadInquiryVariants(courseKey, unitIdx, topicIdx) {
    const variants = [];
    let variant = 1;
    while (true) {
        const docId = inquiryDocId(courseKey, unitIdx, topicIdx, variant);
        const docSnap = await getDoc(doc(db, "inquiry_worksheets", docId));
        if (!docSnap.exists()) break;
        variants.push({ docId, data: docSnap.data() });
        variant++;
    }
    return variants;
}

// 예전/새 활동지 모두에서 AI가 넣은 밑줄("___") 텍스트를 제거합니다. 답 쓸 공간은 레이아웃이 확보합니다.
function stripAnswerBlanks(html) {
    return html.replace(/_{2,}/g, '').replace(/\s+$/, '').trim();
}

function getProcessItems(processHtml) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<ol>${processHtml}</ol>`;
    return Array.from(wrapper.querySelectorAll('li')).map(li => stripAnswerBlanks(li.innerHTML));
}

window.showInquiryActivity = async function(courseKey, unitIdx, topicIdx) {
    openModal('<div style="text-align:center; padding: 4rem; font-size: 1.2rem;">활동지를 불러오는 중입니다... ⏳</div>');

    try {
        const variants = await loadInquiryVariants(courseKey, unitIdx, topicIdx);
        if (variants.length > 0) {
            window.currentInquiryVariants = variants;
            window.currentInquiryVariantIndex = 0;
            renderInquiryModal(variants[0].data, courseKey, unitIdx, topicIdx, variants[0].docId);
        } else {
            const course = INQUIRY_TOPICS[courseKey];
            const topicTitle = course.units[unitIdx].topics[topicIdx];
            document.getElementById('modal-body').innerHTML = `
                <div style="text-align:center; padding: 3rem;">
                    <h3 style="margin-bottom: 1rem;">아직 준비되지 않은 활동지입니다.</h3>
                    <p style="color:#64748b; margin-bottom: 1.5rem;">"${topicTitle}"</p>
                    <button onclick="window.generateInquiryActivity('${courseKey}', ${unitIdx}, ${topicIdx})" style="padding: 0.8rem 1.5rem; background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">✨ AI로 지금 생성하기</button>
                </div>
            `;
        }
    } catch (error) {
        console.error(error);
        document.getElementById('modal-body').innerHTML = '<div style="text-align:center; padding: 3rem; color: #ef4444;">활동지를 불러오지 못했습니다.</div>';
    }
};

// 세트 여러 개를 이전/다음으로 넘겨보는 기능 (문항 탐색과 동일한 패턴)
window.showInquiryVariant = function(courseKey, unitIdx, topicIdx, direction) {
    const variants = window.currentInquiryVariants;
    if (!variants || variants.length <= 1) return;

    window.currentInquiryVariantIndex += direction;
    if (window.currentInquiryVariantIndex < 0) window.currentInquiryVariantIndex = variants.length - 1;
    if (window.currentInquiryVariantIndex >= variants.length) window.currentInquiryVariantIndex = 0;

    const current = variants[window.currentInquiryVariantIndex];
    renderInquiryModal(current.data, courseKey, unitIdx, topicIdx, current.docId);
};

window.generateInquiryActivity = async function(courseKey, unitIdx, topicIdx) {
    if (!currentUser) { alert("구글 로그인을 먼저 해주세요."); return; }
    if (!userApiKey) { document.getElementById('api-modal-overlay').classList.add('active'); return; }

    const course = INQUIRY_TOPICS[courseKey];
    const unit = course.units[unitIdx];
    const topicTitle = unit.topics[topicIdx];

    document.getElementById('modal-body').innerHTML = '<div style="text-align:center; padding: 4rem; font-size: 1.2rem;">AI가 활동지를 창작하는 중입니다... ⏳</div>';

    try {
        const payload = { apiKey: userApiKey, type: 'inquiry', course: course.label, unit: unit.name, topicTitle: topicTitle };
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || '백엔드 통신 오류');

        const parsed = parseInquiryHtml(data.text);
        const docData = {
            course: course.label,
            unit: unit.name,
            title: topicTitle,
            goal: parsed.goal,
            materials: parsed.materials,
            svg: parsed.svg,
            processHtml: parsed.processHtml,
            exampleAnswerHtml: parsed.exampleAnswerHtml,
            createdAt: new Date()
        };

        await setDoc(doc(db, "inquiry_worksheets", inquiryDocId(courseKey, unitIdx, topicIdx)), docData);
        window.currentInquiryVariants = [{ docId: inquiryDocId(courseKey, unitIdx, topicIdx), data: docData }];
        window.currentInquiryVariantIndex = 0;
        renderInquiryModal(docData, courseKey, unitIdx, topicIdx, inquiryDocId(courseKey, unitIdx, topicIdx));
    } catch (error) {
        console.error(error);
        document.getElementById('modal-body').innerHTML = `<div style="text-align:center; padding: 3rem; color: #ef4444;">활동지 생성에 실패했습니다.<br>${error.message}</div>`;
    }
};

function parseInquiryHtml(htmlString) {
    const parser = new DOMParser();
    const parsedDoc = parser.parseFromString(htmlString, 'text/html');
    const getHtml = (id) => parsedDoc.getElementById(id) ? parsedDoc.getElementById(id).innerHTML.trim() : '';
    const getText = (id) => parsedDoc.getElementById(id) ? parsedDoc.getElementById(id).innerText.trim() : '';

    const svgRaw = getHtml('ia-svg');

    return {
        goal: getText('ia-goal'),
        materials: getText('ia-materials'),
        svg: svgRaw.includes('<svg') ? svgRaw : '',
        processHtml: getHtml('ia-process'),
        exampleAnswerHtml: getHtml('ia-example-answer')
    };
}

function renderInquiryModal(data, courseKey, unitIdx, topicIdx, docId) {
    const svgHtml = data.svg ? `<div style="display:flex; justify-content:center; margin: 1rem 0; padding: 1rem; background: white; border: 1px solid #e2e8f0; border-radius: 8px;">${data.svg}</div>` : '';

    const variants = window.currentInquiryVariants || [];
    let navButtonsHtml = '';
    if (variants.length > 1) {
        navButtonsHtml = `
            <div style="display:flex; gap:6px; align-items:center; background:#f1f5f9; padding:3px 6px; border-radius:99px; margin-bottom:0.6rem;">
                <button onclick="window.showInquiryVariant('${courseKey}', ${unitIdx}, ${topicIdx}, -1)" style="background:transparent; color:#475569; border:none; padding:0.2rem 0.5rem; border-radius:99px; font-weight:bold; font-size:0.85rem; cursor:pointer;">⬅️ 이전</button>
                <span style="font-size:0.8rem; font-weight:bold; color:#64748b;">활동지 ${window.currentInquiryVariantIndex + 1}/${variants.length}</span>
                <button onclick="window.showInquiryVariant('${courseKey}', ${unitIdx}, ${topicIdx}, 1)" style="background:transparent; color:#475569; border:none; padding:0.2rem 0.5rem; border-radius:99px; font-weight:bold; font-size:0.85rem; cursor:pointer;">다음 ➡️</button>
            </div>
        `;
    }

    const content = `
        <div style="padding: 0.5rem 1rem;">
            ${navButtonsHtml}
            <div style="display:flex; flex-wrap:wrap; justify-content: space-between; align-items:flex-start; gap: 0.6rem 1rem; margin-bottom: 1rem;">
                <div style="flex: 1 1 200px; min-width: 200px;">
                    <div style="font-size: 0.85rem; color:#64748b; margin-bottom:0.3rem;">${data.course} · ${data.unit}</div>
                    <h3 style="font-size:1.3rem; font-weight:800; color:#0f172a;">🔬 ${data.title}</h3>
                </div>
                <div style="display:flex; gap:0.5rem; flex-shrink:0;">
                    <button onclick="window.downloadInquiryActivity('${docId}')" style="padding: 0.6rem 1rem; background:white; color:#0f172a; border:1px solid #cbd5e1; border-radius:8px; font-weight:bold; cursor:pointer; white-space:nowrap;">💾 저장하기</button>
                    <button onclick="window.printInquiryActivity('${docId}')" style="padding: 0.6rem 1rem; background:#0f172a; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; white-space:nowrap;">🖨️ 인쇄하기</button>
                </div>
            </div>

            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:1rem; margin-bottom:1rem;">
                <strong style="color:#1d4ed8;">🎯 학습 목표</strong>
                <p style="margin: 0.4rem 0 0; color:#1e3a8a;">${data.goal}</p>
            </div>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; margin-bottom:1rem;">
                <strong style="color:#475569;">🧰 준비물</strong>
                <p style="margin: 0.4rem 0 0; color:#334155;">${data.materials}</p>
            </div>

            ${svgHtml}

            <div style="margin-bottom:1rem;">
                <strong style="color:#0f172a; display:block; margin-bottom:0.5rem;">📋 탐구 과정</strong>
                <ol style="padding-left:1.4rem; display:flex; flex-direction:column; gap:1.2rem; color:#1e293b; line-height:1.6;">${getProcessItems(data.processHtml).map(html => `<li>${html}</li>`).join('')}</ol>
            </div>

            <details style="background:#fdf4ff; border:1px solid #f0abfc; border-radius:8px; padding:1rem;">
                <summary style="cursor:pointer; font-weight:bold; color:#a21caf;">💡 (교사용) 예시 답안 보기</summary>
                <div style="margin-top:0.8rem; color:#4a044e; line-height:1.6;">${data.exampleAnswerHtml}</div>
            </details>
        </div>
    `;

    document.getElementById('modal-body').innerHTML = content;
    if (window.MathJax) MathJax.typesetPromise([document.getElementById('modal-body')]).catch((err) => console.error('MathJax 렌더링 에러:', err));
}

window.printInquiryActivity = async function(docId) {
    const docSnap = await getDoc(doc(db, "inquiry_worksheets", docId));
    if (!docSnap.exists()) return;
    const data = docSnap.data();

    const svgHtml = data.svg ? `<div class="svg-wrap">${data.svg}</div>` : '';
    const processItemsHtml = getProcessItems(data.processHtml).map((html, i) => `
        <div class="process-item">
            <div class="process-num">${i + 1}</div>
            <div class="process-text">${html}</div>
        </div>
    `).join('');

    const printWindow = window.open('', '_blank');
    const content = `
    <html>
    <head>
        <title>${data.title} - 탐구활동지</title>
        <style>
            @page { size: A4; margin: 18mm; }
            html, body { height: 261mm; }
            body { font-family: 'Noto Sans KR', sans-serif; line-height: 1.6; color: #111; padding:0; margin:0; font-size: 11.5pt; display: flex; flex-direction: column; }
            .header { flex-shrink: 0; border-bottom: 3px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
            .meta { font-size: 0.85rem; color: #555; margin-bottom: 4px; }
            h1 { font-size: 1.4rem; margin: 4px 0 0; }
            .student-info { display:flex; gap: 30px; margin-top: 10px; font-size: 0.95rem; }
            .student-info span { border-bottom: 1px solid #999; padding: 2px 40px 2px 4px; }
            .box { flex-shrink: 0; border: 1px solid #999; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; }
            .box-title { font-weight: bold; margin-bottom: 6px; }
            .svg-wrap { flex-shrink: 0; display:flex; justify-content:center; margin-bottom: 12px; }
            .process-box { flex: 1; min-height: 0; display: flex; flex-direction: column; }
            .process-list { flex: 1; display: flex; flex-direction: column; }
            .process-item { flex: 1; display: flex; align-items: flex-start; gap: 10px; padding: 8px 2px; border-bottom: 1px dashed #bbb; }
            .process-item:last-child { border-bottom: none; }
            .process-num { flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; background: #111; color: #fff; display:flex; align-items:center; justify-content:center; font-size: 0.85rem; font-weight: bold; }
            .process-text { flex: 1; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="meta">${data.course} · ${data.unit} · 필수탐구활동</div>
            <h1>${data.title}</h1>
            <div class="student-info"><span>이름:</span><span>모둠/번호:</span></div>
        </div>

        <div class="box"><div class="box-title">🎯 학습 목표</div>${data.goal}</div>
        <div class="box"><div class="box-title">🧰 준비물</div>${data.materials}</div>
        ${svgHtml}
        <div class="process-box">
            <div class="box-title">📋 탐구 과정</div>
            <div class="process-list">${processItemsHtml}</div>
        </div>

        <script>
            window.onload = function() { setTimeout(function(){ window.print(); }, 800); };
        </script>
    </body>
    </html>`;
    printWindow.document.write(content);
    printWindow.document.close();
};

// SVG를 워드 문서에 넣을 수 있는 PNG 이미지로 변환합니다. (Word는 인라인 SVG를 제대로 표시하지 못함)
function svgToPngDataUrl(svgString) {
    return new Promise((resolve, reject) => {
        const viewBoxMatch = svgString.match(/viewBox="[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)"/);
        const w = viewBoxMatch ? Math.round(parseFloat(viewBoxMatch[1])) : 600;
        const h = viewBoxMatch ? Math.round(parseFloat(viewBoxMatch[2])) : 250;

        const img = new Image();
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            const scale = 2; // 인쇄 품질을 위해 2배 확대
            const canvas = document.createElement('canvas');
            canvas.width = w * scale;
            canvas.height = h * scale;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
        img.src = url;
    });
}

// 교사가 인쇄 전 자유롭게 고칠 수 있도록, 워드(한글에서도 열림)에서 여는 .doc 파일로 저장합니다.
window.downloadInquiryActivity = async function(docId) {
    const docSnap = await getDoc(doc(db, "inquiry_worksheets", docId));
    if (!docSnap.exists()) return;
    const data = docSnap.data();

    let imageHtml = '';
    if (data.svg) {
        try {
            const pngDataUrl = await svgToPngDataUrl(data.svg);
            imageHtml = `<p style="text-align:center;"><img src="${pngDataUrl}" style="max-width:500px;"></p>`;
        } catch (e) {
            console.error('SVG 변환 실패:', e);
        }
    }

    const processItemsHtml = getProcessItems(data.processHtml).map((html, i) => `
        <p style="margin:0 0 10px 0;"><b>${i + 1}.</b> ${html}</p>
    `).join('');

    const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
        <meta charset="utf-8">
        <title>${data.title}</title>
        <style>
            body { font-family: '맑은 고딕', sans-serif; font-size: 11pt; line-height: 1.7; color:#111; }
            h1 { font-size: 16pt; margin: 6px 0 12px; }
            .meta { color: #555; font-size: 10pt; }
            .box-title { font-weight: bold; margin-top: 16px; margin-bottom: 6px; }
        </style>
    </head>
    <body>
        <div class="meta">${data.course} · ${data.unit} · 필수탐구활동</div>
        <h1>${data.title}</h1>
        <p>이름: ______________&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;모둠/번호: ______________</p>

        <p class="box-title">🎯 학습 목표</p>
        <p>${data.goal}</p>

        <p class="box-title">🧰 준비물</p>
        <p>${data.materials}</p>

        ${imageHtml}

        <p class="box-title">📋 탐구 과정</p>
        ${processItemsHtml}

        <br clear="all" style="page-break-before:always">

        <p class="box-title">💡 (교사용) 예시 답안</p>
        <p>${data.exampleAnswerHtml}</p>
    </body>
    </html>`;

    const blob = new Blob(["﻿", htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title}_활동지.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// 6. Analysis Logic
function initAnalysis() {
    const analyzeBtn = document.getElementById('analyze-btn');
    const resultDiv = document.getElementById('analysis-result');
    
    const btnUploadFile = document.getElementById('btn-upload-file');
    const btnUploadCamera = document.getElementById('btn-upload-camera');
    const fileInput = document.getElementById('file-input');
    const cameraInput = document.getElementById('camera-input');
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('preview-img');
    const btnRemoveImage = document.getElementById('btn-remove-image');
    const uploadButtonsContainer = document.getElementById('upload-buttons-container');

    if (!analyzeBtn) return;

    const handleImageFile = (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            selectedImageBase64 = e.target.result.split(',')[1];
            selectedImageMimeType = file.type;
            previewContainer.style.display = 'inline-block';
            uploadButtonsContainer.style.display = 'none';
        };
        reader.readAsDataURL(file);
    };

    btnUploadFile.addEventListener('click', () => fileInput.click());
    btnUploadCamera.addEventListener('click', () => cameraInput.click());
    fileInput.addEventListener('change', (e) => handleImageFile(e.target.files[0]));
    cameraInput.addEventListener('change', (e) => handleImageFile(e.target.files[0]));

    document.addEventListener('paste', (e) => {
        // 👇 [핵심 수정] 문항 분석 탭이 화면에 열려있을 때만 붙여넣기를 허용하도록 방어막 추가!
        if (!document.getElementById('analysis').classList.contains('active')) return;

        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                handleImageFile(blob);
            }
        }
    });

    btnRemoveImage.addEventListener('click', () => {
        selectedImageBase64 = null;
        selectedImageMimeType = null;
        previewImg.src = '';
        previewContainer.style.display = 'none';
        uploadButtonsContainer.style.display = 'flex';
        fileInput.value = '';
        cameraInput.value = '';
    });

    analyzeBtn.addEventListener('click', async () => {
        if (!currentUser) { alert('AI 문항 분석을 사용하려면 구글 로그인을 해주세요.'); return; }
        if (!userApiKey) { document.getElementById('api-modal-overlay').classList.add('active'); return; }
        if (!selectedImageBase64) { alert('분석할 문항 이미지를 업로드하거나 붙여넣기 해주세요.'); return; }

        analyzeBtn.disabled = true;
        analyzeBtn.style.backgroundColor = "#94a3b8";
        analyzeBtn.innerHTML = `⏳ AI가 문항을 분석하고 풀이를 작성 중입니다...`;
        resultDiv.style.display = 'none';
        
        try {
            // 💡 [핵심 수정] 현재 화면에 선택된 과목만 보내지 않고, DB에서 '전체 과목'의 성취기준을 모조리 가져옵니다!
            const allStdsSnapshot = await getDocs(collection(window.db, "standards"));
            const allStandards = [];
            allStdsSnapshot.forEach(doc => allStandards.push(doc.data()));

            const curriculumContext = allStandards.map(s => {
                // 💡 안전장치: levels 데이터가 없으면 빈 객체({})로 처리하여 에러를 원천 차단합니다.
                const lvls = s.levels || {}; 
                return `[과목: ${s.course || '공통'}] 단원: ${s.unit || '미분류'}\n` + 
                `- 성취기준 코드: ${s.standardId || '미상'}, 내용: ${s.description || '내용 없음'}\n` +
                `  [성취수준] A: ${lvls.A || '없음'}, B: ${lvls.B || '없음'}, C: ${lvls.C || '없음'}, D: ${lvls.D || '없음'}, E: ${lvls.E || '없음'}`;
            }).join('\n\n');    

            // 챗봇도 전체 데이터를 볼 수 있도록 전역 변수에 저장해둡니다.
            window.fullCurriculumContext = curriculumContext;

            // 💡 프론트엔드에서 긴 프롬프트를 빼고, 백엔드로 데이터만 예쁘게 포장해서 보냅니다!
            const payload = {
                apiKey: userApiKey,
                type: 'analysis',
                curriculumContext: curriculumContext,
                imageBase64: selectedImageBase64 || null,
                imageMimeType: selectedImageMimeType || null
            };

            // 구글 앱스 스크립트(백엔드)로 요청 보내기
            const response = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            
            // 백엔드에서 에러가 났다면 중단
            if (!data.success) throw new Error(data.error || '백엔드 처리 중 오류가 발생했습니다.');

            // AI 답변 결과 받기
            const aiResultHtml = data.text;
            resultDiv.style.display = 'block';
            
            resultDiv.innerHTML = `
                <div class="card" style="border: 2px solid #22c55e; background: white; border-radius: 24px; padding: 2.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); margin-top: 2rem;">
                    <h3 style="color: #22c55e; margin-bottom: 1.5rem; font-size: 1.4rem; font-weight: 800;">AI 상세 분석 및 풀이 결과</h3>
                    ${aiResultHtml}
                    
                    <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px dashed #e2e8f0; text-align: center;">
                        <button id="btn-open-save-modal" style="padding: 12px 24px; background: #0f172a; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px; margin: 0 auto;">
                            💾 분석 결과를 DB에 문항으로 저장하기
                        </button>
                    </div>
                </div>
            `;

            if (window.MathJax) {
                MathJax.typesetPromise([resultDiv]).catch((err) => console.error('MathJax 렌더링 에러:', err));
            }

            // 👇 [새로 추가할 코드] 성취기준 텍스트에 밑줄을 긋고 클릭 이벤트를 연결합니다.
            const makeClickable = (id) => {
                const el = document.getElementById(id);
                if (el && el.innerText.trim() !== '미분류' && el.innerText.trim() !== '없음') {
                    el.style.cursor = 'pointer';
                    el.style.textDecoration = 'underline';
                    el.style.color = '#2563eb';
                    el.title = "클릭하여 성취수준 상세 루브릭 보기";
                    el.addEventListener('click', () => showStandardDetails(el.innerText));
                }
            };
            makeClickable('ai-main-std');
            makeClickable('ai-sub-stds');
            // 👆 추가 끝

            // 최신 데이터를 메모리에 저장 (챗봇용)
            window.extractDataToState(aiResultHtml);
            window.lastAnalysisResult = aiResultHtml;
            window.lastAnalyzedImage = selectedImageBase64;
            window.lastAnalyzedImageMime = selectedImageMimeType;

            document.getElementById('btn-open-save-modal').addEventListener('click', () => {
                document.getElementById('save-std-id').value = window.currentAnalysisState.mainStd;
                document.getElementById('save-level').value = window.currentAnalysisState.level;
                
                const qText = document.getElementById('save-question-text');
                if (qText) qText.value = window.currentAnalysisState.question;
                
                const aText = document.getElementById('save-correct-answer');
                if (aText) aText.value = window.currentAnalysisState.answer;

                let subStdInput = document.getElementById('save-sub-stds');
                if (!subStdInput) {
                    const mainStdInput = document.getElementById('save-std-id');
                    subStdInput = document.createElement('input');
                    subStdInput.id = 'save-sub-stds';
                    subStdInput.type = 'text';
                    subStdInput.style.marginTop = '10px';
                    subStdInput.placeholder = '보조성취기준 (쉼표로 구분, 예: 10통과1-01-02)';
                    mainStdInput.parentNode.insertBefore(subStdInput, mainStdInput.nextSibling);
                }
                subStdInput.value = window.currentAnalysisState.subStds === '없음' ? '' : window.currentAnalysisState.subStds;

                document.getElementById('save-modal-overlay').classList.add('active');
            });

            const resetBtnContainer = document.getElementById('reset-btn-container');
            const chatbotToggleBtn = document.getElementById('chatbot-toggle-button');
            if(resetBtnContainer) resetBtnContainer.style.display = 'block';
            if(chatbotToggleBtn) chatbotToggleBtn.style.display = 'block';

        } catch (error) {
            console.error("❌ 분석 중 에러 발생:", error);
            alert(`분석 실패: ${error.message}`);
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.style.backgroundColor = "var(--primary-color)";
            analyzeBtn.textContent = 'AI 문항 분석 시작';
        }
    });
}

// 7. Firebase Auth
function initFirebaseAuth() {
    const btnLogin = document.getElementById('btn-google-login');
    const btnLogout = document.getElementById('btn-logout');
    const btnApiSetup = document.getElementById('btn-api-setup');
    const userNameDisplay = document.getElementById('user-name-display');
    const apiModalOverlay = document.getElementById('api-modal-overlay');
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            btnLogin.style.display = 'none';
            userNameDisplay.style.display = 'inline-block';
            userNameDisplay.textContent = `${user.displayName} 선생님`;
            btnLogout.style.display = 'inline-block';
            
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().apiKey) {
                userApiKey = docSnap.data().apiKey;
            }
        } else {
            currentUser = null;
            userApiKey = "";
            btnLogin.style.display = 'inline-block';
            userNameDisplay.style.display = 'none';
            btnLogout.style.display = 'none';
        }
    });

    btnLogin.addEventListener('click', () => signInWithPopup(auth, provider));
    btnLogout.addEventListener('click', () => signOut(auth));
    
    btnApiSetup.addEventListener('click', () => {
        if (!currentUser) {
            alert("구글 로그인을 먼저 해주세요.");
            return;
        }
        document.getElementById('api-key-input').value = userApiKey; 
        apiModalOverlay.classList.add('active');
    });
    
    document.getElementById('api-modal-close').addEventListener('click', () => apiModalOverlay.classList.remove('active'));

    document.getElementById('btn-save-api').addEventListener('click', async () => {
        if (!currentUser) return;
        const newKey = document.getElementById('api-key-input').value.trim();
        if (!newKey) { alert("API Key를 입력해주세요."); return; }
        
        const btn = document.getElementById('btn-save-api');
        btn.textContent = "저장 중...";
        try {
            await setDoc(doc(db, "users", currentUser.uid), { apiKey: newKey, updatedAt: new Date() }, { merge: true });
            userApiKey = newKey;
            alert("개인 API Key가 데이터베이스에 안전하게 저장되었습니다!");
            apiModalOverlay.classList.remove('active');
        } catch (error) {
            alert("저장 실패: " + error.message);
        } finally {
            btn.textContent = "설정 저장하고 분석 시작하기";
        }
    });
}

// 8. Chatbot Logic
const chatbotPanel = document.getElementById('chatbot-panel');
const chatbotToggleBtn = document.getElementById('chatbot-toggle-button');
const chatbotCloseBtn = document.getElementById('chatbot-close-button');
const chatbotInput = document.getElementById('chatbot-input');
const chatbotSendBtn = document.getElementById('chatbot-send-button');
const chatbotMessages = document.getElementById('chatbot-messages');

function toggleChatbot() {
  chatbotPanel.classList.toggle('chatbot-hidden');
}

chatbotToggleBtn.addEventListener('click', toggleChatbot);
chatbotCloseBtn.addEventListener('click', toggleChatbot);

function addMessage(text, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('chatbot-message', sender);
  messageDiv.textContent = `${sender === 'user' ? '나: ' : '챗봇: '} ${text}`;
  chatbotMessages.appendChild(messageDiv);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight; 
}

async function sendMessage() {
    const messageText = chatbotInput.value.trim();
    if (!messageText) return;
  
    if (!currentUser || !userApiKey) {
      alert('챗봇 기능을 사용하려면 구글 로그인 및 API Key 설정이 필요합니다.');
      document.getElementById('api-modal-overlay').classList.add('active');
      return;
    }
  
    addMessage(messageText, 'user');
    chatbotInput.value = ''; 
  
    chatbotInput.disabled = true;
    chatbotSendBtn.disabled = true;
    chatbotSendBtn.textContent = '⏳';
    
    const loadingId = 'loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.classList.add('chatbot-message', 'bot');
    loadingDiv.innerHTML = `
    <div class="typing-indicator">
      분석 결과를 바탕으로 답변 작성 중<span></span><span></span><span></span>
    </div>`;
    chatbotMessages.appendChild(loadingDiv);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  
    try {
        // 💡 [수정] 챗봇에게도 아까 저장해둔 '전체 과목' 성취기준 데이터를 컨닝 페이퍼로 넘겨줍니다!
        const curriculumContext = window.fullCurriculumContext || "성취기준 데이터를 불러오지 못했습니다.";

        const payload = {
            apiKey: userApiKey,
            type: 'chat',
            curriculumContext: curriculumContext, // 👈 [추가됨] 
            state: window.currentAnalysisState,
            message: messageText,
            imageBase64: window.lastAnalyzedImage || null,
            imageMimeType: window.lastAnalyzedImageMime || null
        };

        // 구글 앱스 스크립트(백엔드)로 챗봇 데이터 전송
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
    
        const data = await response.json();
        if (!data.success) throw new Error(data.error || '백엔드 통신 오류');
  
        const botReply = data.text;
  
        document.getElementById(loadingId).remove();
        const replyDiv = document.createElement('div');
        replyDiv.classList.add('chatbot-message', 'bot');
      
        let formattedReply = botReply.replace(/\*\*/g, '').replace(/\n/g, '<br>');
        replyDiv.innerHTML = formattedReply; 
        chatbotMessages.appendChild(replyDiv);

        // 챗봇 대화로 인해 분석 데이터가 업데이트 된 경우 처리
        if (botReply.includes('id="chatbot-update-data"')) {
            window.extractDataToState(botReply);
            console.log("✅ 챗봇 대화로 인해 분석 데이터가 업데이트 되었습니다.", window.currentAnalysisState);
        }

        if (window.MathJax) {
            MathJax.typesetPromise([replyDiv]).catch((err) => console.error('MathJax 렌더링 에러:', err));
        }
  
    } catch (error) {
      console.error(error);
      document.getElementById(loadingId).remove();
      addMessage(`⚠️ 죄송합니다. 답변을 가져오는 중 오류가 발생했습니다: ${error.message}`, 'bot');
    } finally {
      chatbotInput.disabled = false;
      chatbotSendBtn.disabled = false;
      chatbotSendBtn.textContent = '전송';
      chatbotInput.focus();
      chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }
}

chatbotSendBtn.addEventListener('click', sendMessage);
chatbotInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    sendMessage();
  }
});

// 9. Floating Buttons & Reset
document.getElementById('btn-scroll-top')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('btn-reset-analysis')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    const resultDiv = document.getElementById('analysis-result');
    if(resultDiv) resultDiv.style.display = 'none';
    const resetContainer = document.getElementById('reset-btn-container');
    if(resetContainer) resetContainer.style.display = 'none';
    
    const chatbotToggleBtn = document.getElementById('chatbot-toggle-button');
    if(chatbotToggleBtn) chatbotToggleBtn.style.display = 'none';
    const chatbotPanel = document.getElementById('chatbot-panel');
    if(chatbotPanel) chatbotPanel.classList.add('chatbot-hidden');
    
    window.lastAnalysisResult = null;
    window.lastAnalyzedImage = null;
    window.lastAnalyzedImageMime = null;
    
    const removeImgBtn = document.getElementById('btn-remove-image');
    if(removeImgBtn) removeImgBtn.click();
    
    const chatMessages = document.getElementById('chatbot-messages');
    if(chatMessages) {
        chatMessages.innerHTML = `
            <div class="chatbot-message bot" style="background-color: #e0f2fe; border-left: 4px solid #0284c7;">
                <strong style="display:block; margin-bottom:5px; font-size:0.85rem; color:#0369a1;">통합과학 챗봇</strong>
                <div>문항 분석을 진행한 후 저를 호출해 주세요. 분석 결과를 바탕으로 궁금한 점을 답변해 드립니다!</div>
            </div>`;
    }
});

// ====================================================================
// 10. Database Save Logic (융합 문항 다중 저장 & 미분류 처리)
// ====================================================================

document.getElementById('btn-final-db-save')?.addEventListener('click', async () => {
    if (!currentUser) {
        alert("데이터베이스에 저장하려면 구글 로그인이 필요합니다.");
        return;
    }

    const mainStd = document.getElementById('save-std-id').value.trim();
    const subStdsInput = document.getElementById('save-sub-stds');
    const subStdsStr = subStdsInput ? subStdsInput.value.trim() : "";
    
    const level = document.getElementById('save-level').value.trim();
    const saveBtn = document.getElementById('btn-final-db-save');
    const questionText = document.getElementById('save-question-text').value.trim();
    const correctAnswer = document.getElementById('save-correct-answer').value;

    if (!questionText) {
        alert("발문(문제 텍스트)이 비어있습니다. AI 변형 문항이 잘 생성되었는지 확인해주세요.");
        return;
    }

    // 💡 메모리에 저장된 최신 SVG 사용
    const generatedSvg = window.currentAnalysisState.svg || null;

    saveBtn.textContent = "DB에 일괄 저장 중입니다...";
    saveBtn.disabled = true;

    try {
        // 주성취기준과 보조성취기준을 하나의 배열로 합치고, 빈 값이 없도록 정리합니다.
        let rawStds = [mainStd];
        if (subStdsStr && subStdsStr !== '없음') {
            const parsedSub = subStdsStr.split(',').map(s => s.trim()).filter(s => s);
            rawStds = rawStds.concat(parsedSub);
        }

        // 중복 제거
        const allStds = [...new Set(rawStds)];

        let savedCount = 0;

        for (const std of allStds) {
            // '미분류'이거나 형식이 완전히 틀린 경우 standards 문서 업데이트는 건너뛰고 문항만 저장합니다.
            const isUnclassified = (std === '미분류' || std === '없음');

            if (!isUnclassified) {
                const stdDocRef = doc(db, "standards", std);
                await setDoc(stdDocRef, {
                    standardId: std,
                    [level]: true, 
                    lastUpdatedAt: new Date()
                }, { merge: true });
            }

            // 각 성취기준 서랍(questions 컬렉션)에 동일한 변형 문항을 개별적으로 저장합니다.
            await addDoc(collection(db, "questions"), {
                standardId: std,  // 👈 주성취/보조성취/미분류가 각각 다르게 들어갑니다.
                level: level,
                isMCP: window.currentAnalysisState.isMCP === 'O', // 👈 [추가됨] 'O'면 true, 아니면 false로 저장
                question: questionText, 
                conditions: window.currentAnalysisState.conditions || [], 
                options: window.currentAnalysisState.options,
                answer: parseInt(correctAnswer), 
                imageUrl: null, 
                svgImage: generatedSvg, 
                aiReason: window.currentAnalysisState.reason || "풀이 결과 없음",
                createdAt: new Date(),
                authorUid: currentUser.uid,
                isMainStandard: std === mainStd // 주/보조 구분 메타데이터 추가
            });
            
            savedCount++;
        }
        
        alert(`🎉 저작권 프리 문항이 총 ${savedCount}개의 성취기준 서랍에 성공적으로 분산 저장되었습니다!`);
        const saveModalOverlay = document.getElementById('save-modal-overlay');
        if (saveModalOverlay) saveModalOverlay.classList.remove('active');
        
    } catch (error) {
        console.error("DB 저장 에러:", error);
        alert("저장 실패: 데이터 무결성을 위해 콘솔을 확인해주세요.\n" + error.message);
    } finally {
        saveBtn.textContent = "데이터베이스에 최종 저장하기";
        saveBtn.disabled = false;
    }
});

// 11. Chatbot Resize
function initChatbotResize() {
    const panel = document.getElementById('chatbot-panel');
    if (!panel) return;

    const directions = ['top', 'left', 'right', 'bottom', 'top-left'];
    
    directions.forEach(dir => {
        const resizer = document.createElement('div');
        resizer.className = `resizer resizer-${dir}`;
        panel.appendChild(resizer);

        resizer.addEventListener('mousedown', initDrag);
        
        function initDrag(e) {
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = parseInt(document.defaultView.getComputedStyle(panel).width, 10);
            const startHeight = parseInt(document.defaultView.getComputedStyle(panel).height, 10);
            
            const startRight = parseInt(document.defaultView.getComputedStyle(panel).right, 10) || 20;
            const startBottom = parseInt(document.defaultView.getComputedStyle(panel).bottom, 10) || 80;

            function doDrag(e) {
                if (dir.includes('left')) {
                    panel.style.width = (startWidth - (e.clientX - startX)) + 'px';
                }
                if (dir.includes('top')) {
                    panel.style.height = (startHeight - (e.clientY - startY)) + 'px';
                }
                if (dir.includes('right')) {
                    panel.style.width = (startWidth + (e.clientX - startX)) + 'px';
                    panel.style.right = (startRight - (e.clientX - startX)) + 'px';
                }
                if (dir.includes('bottom')) {
                    panel.style.height = (startHeight + (e.clientY - startY)) + 'px';
                    panel.style.bottom = (startBottom - (e.clientY - startY)) + 'px';
                }
            }

            function stopDrag() {
                document.documentElement.removeEventListener('mousemove', doDrag);
                document.documentElement.removeEventListener('mouseup', stopDrag);
            }

            document.documentElement.addEventListener('mousemove', doDrag);
            document.documentElement.addEventListener('mouseup', stopDrag);
        }
    });
}
// ====================================================================
// [임시 스크립트] 불량 문항 JSON 다운로드
// ====================================================================
window.exportBadQuestionsToJson = async function() {
    console.log("🔍 불량 문항 탐색 및 다운로드 준비 중...");
    try {
        // 이미 파일 상단에 import 되어 있는 collection, getDocs, db를 그대로 사용합니다.
        const qRef = collection(db, "questions"); 
        const querySnapshot = await getDocs(qRef);
        const badQuestions = [];

        querySnapshot.forEach((document) => {
            const data = document.data();
            const qText = data.question || "";
            const options = data.options || [];
            
            const isBadQuestion = qText.includes("①") || qText.includes("②") ||
                                  (options.length > 0 && (options[0].includes("① 번") || options[0].includes("선지 인식 실패")));

            if (isBadQuestion) {
                badQuestions.push({
                    docId: document.id, 
                    standardId: data.standardId,
                    level: data.level,
                    question: qText,
                    conditions: data.conditions || [],
                    options: options,
                    answer: data.answer
                });
            }
        });

        if (badQuestions.length === 0) {
            alert("👏 불량 문항이 없습니다!");
            return;
        }

        const dataStr = JSON.stringify(badQuestions, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "bad_questions.json"; 
        a.click();
        URL.revokeObjectURL(url);
        
        console.log(`✅ 총 ${badQuestions.length}개의 불량 문항이 다운로드되었습니다.`);
        alert(`✅ 총 ${badQuestions.length}개의 불량 문항이 추출되었습니다. 다운로드 폴더를 확인해주세요.`);
        
    } catch (error) {
        console.error("다운로드 중 오류 발생:", error);
        alert("오류가 발생했습니다. 콘솔을 확인해주세요.");
    }
};


// ====================================================================
// 12. 성취기준 상세 보기 팝업 (모달) 기능 (DB 직접 조회로 업그레이드)
// ====================================================================
window.showStandardDetails = async function(clickedText) {
    if (!clickedText || clickedText === '미분류' || clickedText === '없음') return;

    // 정규식으로 텍스트 안에서 성취기준 코드(예: 10통과1-01-01)만 쏙 뽑아냅니다.
    const stdMatch = clickedText.match(/\d{2}[가-힣]+\d*-\d{2}-\d{2}/);
    if (!stdMatch) return;
    const stdId = stdMatch[0];

    try {
        // 💡 핵심 수정: 화면의 캐시 데이터에 의존하지 않고, DB에서 해당 코드를 직접 검색합니다!
        const docRef = doc(db, "standards", stdId);
        const docSnap = await getDoc(docRef);

        let stdObj = null;

        if (docSnap.exists()) {
            stdObj = docSnap.data();
        } else {
            // DB에 문서가 없다면 마지막으로 캐시를 확인해봅니다.
            stdObj = (window.cachedStandards || []).find(s => s.standardId === stdId);
        }

        if (!stdObj) {
            alert(`데이터베이스에서 [${stdId}]에 해당하는 상세 내용을 찾을 수 없습니다.\n아직 DB에 등록되지 않은 성취기준일 수 있습니다.`);
            return;
        }

        // levels 데이터가 비어있을 경우를 대비한 안전장치
        const levels = stdObj.levels || {};
        const levelsHtml = Object.entries(levels).sort().map(([lvl, desc]) => {
            let bgColor = '#f8fafc';
            let textColor = '#475569';
            if (lvl === 'A') { bgColor = '#eff6ff'; textColor = '#2563eb'; }
            else if (lvl === 'B') { bgColor = '#f0fdf4'; textColor = '#16a34a'; }
            else if (lvl === 'C') { bgColor = '#fefce8'; textColor = '#d97706'; }
            else if (lvl === 'D') { bgColor = '#fef2f2'; textColor = '#dc2626'; }

            return `
                <div style="padding: 0.8rem; background: ${bgColor}; border-radius: 6px; border: 1px solid #cbd5e1;">
                    <strong style="color: ${textColor}; font-size: 0.95rem; margin-bottom: 0.3rem; display: block;">[${lvl} 수준]</strong>
                    <span style="color: #333; line-height: 1.4; font-size: 0.85rem;">${desc || '내용 없음'}</span>
                </div>
            `;
        }).join('');

        const modalContent = `
            <div style="padding: 0.5rem;">
                <h3 style="color: #0f172a; margin-bottom: 0.8rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; font-size: 1.1rem; display: flex; align-items: center;">
                    <span style="background: #e0e7ff; color: #2563eb; padding: 0.2rem 0.5rem; border-radius: 6px; margin-right: 8px; font-size: 0.95rem;">${stdObj.standardId}</span>
                    <span style="font-weight: 700; font-size: 0.95rem;">상세 루브릭</span>
                </h3>
                <p style="font-weight: 800; font-size: 0.95rem; margin-bottom: 1rem; line-height: 1.4; color: #1e293b;">${stdObj.description || '설명 없음'}</p>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    ${levelsHtml}
                </div>
            </div>
        `;
        
        openModal(modalContent);

    } catch (error) {
        console.error("성취기준 모달 로드 에러:", error);
        alert("데이터베이스에서 상세 내용을 불러오는 중 오류가 발생했습니다.");
    }
};

// 페이지 내의 모든 std-id-badge 클래스를 클릭하면 반응하도록 이벤트 위임
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('std-id-badge')) {
        const stdId = event.target.innerText.trim();
        if (stdId && stdId !== '미분류' && stdId !== '없음') {
            // 💡 존재하지 않는 함수(showStandardModal)를 호출하고 있어 클릭해도 아무 반응이 없었습니다.
            // AI 문항분석 탭에서 이미 쓰고 있는 실제 함수(showStandardDetails)를 호출하도록 수정.
            window.showStandardDetails(stdId);
        }
    }
});

// ====================================================================
// [수정됨] AI 문항 제작 로직 (Progressive UI 완벽 적용)
// ====================================================================
function initQuestionCreation() {
    const btnGen = document.getElementById('btn-type-general');
    const btnMcp = document.getElementById('btn-type-mcp');
    const progSection = document.getElementById('progressive-sections');
    const chkOther = document.getElementById('chk-other');
    const otherTextarea = document.getElementById('create-other-textarea');
    const btnGenerateAI = document.getElementById('btn-generate-ai');
    const resultDiv = document.getElementById('creation-result');
    const loadingMsg = document.getElementById('create-loading-msg');

    if(!btnGen) return;

    let creationType = 'general'; // 기본값 설정

    // 1. 유형 선택 시 아래 메뉴들이 나타나는 효과 (Progressive Disclosure)
    btnGen.addEventListener('click', () => {
        creationType = 'general';
        btnGen.className = "flex-1 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg border-2 border-blue-500 bg-blue-50 text-blue-700 transition-colors";
        btnMcp.className = "flex-1 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg border-2 border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors";
        progSection.classList.remove('hidden');
    });

    btnMcp.addEventListener('click', () => {
        creationType = 'mcp';
        btnMcp.className = "flex-1 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg border-2 border-blue-500 bg-blue-50 text-blue-700 transition-colors";
        btnGen.className = "flex-1 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg border-2 border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors";
        progSection.classList.remove('hidden');
    });

    // 2. 기타 지시사항 체크 시 텍스트 박스 나타나기
    chkOther.addEventListener('change', (e) => {
        if(e.target.checked) otherTextarea.classList.remove('hidden');
        else otherTextarea.classList.add('hidden');
    });

    // 3. AI 문항 창작 실행 로직
    btnGenerateAI.addEventListener('click', async () => {
        if (!currentUser) { alert('AI 문항 제작을 사용하려면 구글 로그인을 해주세요.'); return; }
        if (!userApiKey) { document.getElementById('api-modal-overlay').classList.add('active'); return; }

        // 화면에서 사용자가 선택한 값들 수집
        const mainStd = document.getElementById('create-main-std').value || '미분류';
        const selectedLevel = document.querySelector('input[name="create-level"]:checked').value;
        const isMultipleChoice = document.getElementById('chk-multiple').checked;
        const isComplexChoice = document.getElementById('chk-complex').checked;
        const otherInst = chkOther.checked ? otherTextarea.value : '';

        // AI에게 보낼 프롬프트 조립
        let conditionsText = `
        - 타겟 성취기준 코드: ${mainStd}
        - 목표 성취수준: ${selectedLevel} 수준
        - 성취수준 경계선(MCP) 여부: ${creationType === 'mcp' ? 'O (MCP 최소능력자 문항으로 출제)' : 'X (일반 문항으로 출제)'}
        - 문항 형태: ${isMultipleChoice ? '오지선다형' : ''} ${isComplexChoice ? '합답형(ㄱ,ㄴ,ㄷ)' : ''}
        - 추가 요구사항: ${otherInst}
        `;

        // 로딩 화면 전환
        btnGenerateAI.disabled = true;
        btnGenerateAI.classList.add('hidden');
        loadingMsg.classList.remove('hidden');
        resultDiv.style.display = 'none';

        try {
            // 성취기준 DB 불러오기
            const allStdsSnapshot = await getDocs(collection(window.db, "standards"));
            const allStandards = [];
            allStdsSnapshot.forEach(doc => allStandards.push(doc.data()));
            const curriculumContext = allStandards.map(s => {
                const lvls = s.levels || {}; 
                return `[과목: ${s.course || '공통'}] 단원: ${s.unit || '미분류'}\n- 성취기준 코드: ${s.standardId || '미상'}, 내용: ${s.description || '내용 없음'}\n  [성취수준] A: ${lvls.A || '없음'}, B: ${lvls.B || '없음'}`;
            }).join('\n\n');    

            const payload = {
                apiKey: userApiKey,
                type: 'create', // 문항 제작용 통로
                curriculumContext: curriculumContext,
                conditions: conditionsText
            };

            // 백엔드(GAS)에 요청 보내기
            const response = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error || '오류 발생');

            // 성공 시 결과 화면에 그리기
            const aiResultHtml = data.text;
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `
                <div class="bg-white p-8 rounded-xl shadow-md border-t-4 border-blue-500 fade-in" style="font-family: 'Noto Sans KR', sans-serif;">
                    <h3 class="text-xl font-bold mb-4 text-blue-800">✨ AI 문항 창작 완료</h3>
                    ${aiResultHtml}
                    
                    <div class="mt-8 pt-6 border-t border-gray-200 text-center">
                        <button id="btn-open-save-modal-creation" class="bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-6 rounded-lg transition" style="font-size: 1.1rem;">
                            💾 창작된 문항 DB에 저장하기
                        </button>
                    </div>
                </div>
            `;

            // 수식(MathJax) 렌더링 및 데이터 메모리 저장 (융합 DB 저장 연동용)
            if (window.MathJax) MathJax.typesetPromise([resultDiv]).catch(console.error);
            window.extractDataToState(aiResultHtml);

            // DB 저장 버튼 클릭 이벤트 연결
            document.getElementById('btn-open-save-modal-creation').addEventListener('click', () => {
                document.getElementById('save-std-id').value = window.currentAnalysisState.mainStd;
                document.getElementById('save-level').value = window.currentAnalysisState.level;
                const qText = document.getElementById('save-question-text');
                if (qText) qText.value = window.currentAnalysisState.question;
                const aText = document.getElementById('save-correct-answer');
                if (aText) aText.value = window.currentAnalysisState.answer;
                document.getElementById('save-modal-overlay').classList.add('active');
            });

        } catch (error) {
            console.error(error);
            alert(`문항 제작 실패: ${error.message}`);
        } finally {
            // 버튼 상태 원상복구
            btnGenerateAI.disabled = false;
            btnGenerateAI.classList.remove('hidden');
            loadingMsg.classList.add('hidden');
        }
    });
}
// ====================================================================
// [AI 문항 제작 탭 전용 로직 (완전 개편)] 
// ====================================================================

window.currentType = null;
window.resultCounter = 0;
window.isEditingMode = false;
window.activeTargetId = null;
window.subStandardCount = 0;

// [DB 매핑] 0. Firebase에서 성취기준을 불러와서 드롭다운에 채워넣는 로직
window.initCreationDB = async function() {
    try {
        const snapshot = await window.getDocs(window.collection(window.db, "standards"));
        window.allDbStandards = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            // 선생님의 파이어베이스 필드명(course, unit, description)을 정확히 매핑합니다.
            data.standardId = data.standardId || doc.id; 
            data.course = data.course || '공통';
            data.unit = data.unit || '미분류';
            data.description = data.description || '성취기준 설명 없음';
            window.allDbStandards.push(data);
        });
        
        window.groupedDbStandards = {};
        window.allDbStandards.forEach(std => {
            if(!window.groupedDbStandards[std.course]) window.groupedDbStandards[std.course] = {};
            if(!window.groupedDbStandards[std.course][std.unit]) window.groupedDbStandards[std.course][std.unit] = [];
            window.groupedDbStandards[std.course][std.unit].push(std);
        });
        
        window.populateCourseDropdown(0);
    } catch(e) { 
        console.error("DB Load Error in Creation Tab", e); 
    }
};

window.populateCourseDropdown = function(rowId) {
    const courseSelect = document.getElementById(`course-select-${rowId}`);
    if(!courseSelect) return;
    courseSelect.innerHTML = '<option value="">과목 선택</option>';
    if(window.groupedDbStandards) {
        Object.keys(window.groupedDbStandards).sort().forEach(course => {
            courseSelect.innerHTML += `<option value="${course}">${course}</option>`;
        });
    }
};

window.loadUnits = function(selectElem, rowId) {
    const course = selectElem.value;
    const unitSelect = document.getElementById(`unit-select-${rowId}`);
    const stdInput = document.getElementById(`std-input-${rowId}`);
    
    unitSelect.innerHTML = '<option value="">단원 선택</option>';
    stdInput.value = '';
    
    if(course && window.groupedDbStandards[course]) {
        Object.keys(window.groupedDbStandards[course]).sort().forEach(unit => {
            unitSelect.innerHTML += `<option value="${unit}">${unit}</option>`;
        });
    }
};

window.loadStandards = function(selectElem, rowId) {
    const course = document.getElementById(`course-select-${rowId}`).value;
    const unit = selectElem.value;
    const stdList = document.getElementById(`std-list-${rowId}`);
    const stdInput = document.getElementById(`std-input-${rowId}`);
    
    stdList.innerHTML = '';
    stdInput.value = '';

    if(course && unit && window.groupedDbStandards[course][unit]) {
        window.groupedDbStandards[course][unit].sort((a,b)=>a.standardId.localeCompare(b.standardId)).forEach(std => {
            // 선택 리스트에서는 설명(description)과 코드를 함께 보여줌
            const displayText = `[${std.standardId}] ${std.description}`;
            stdList.innerHTML += `<li class="p-3 border-b hover:bg-blue-50 cursor-pointer font-medium text-gray-700" onclick="window.selectStandard(this, '${std.standardId}')">${displayText}</li>`;
        });
    }
};

window.toggleDropdown = function(inputElem) {
    document.querySelectorAll('.custom-select-list').forEach(list => list.classList.add('hidden'));
    inputElem.nextElementSibling.classList.toggle('hidden');
};

window.selectStandard = function(liElem, standardId) {
    const inputElem = liElem.parentElement.previousElementSibling;
    inputElem.value = standardId; // 클릭하면 코드(standardId)만 입력창에 들어감
    liElem.parentElement.classList.add('hidden');
};

window.addSubStandard = function() {
    window.subStandardCount++;
    const container = document.getElementById('creation-standards-container');
    const newRow = document.createElement('div');
    newRow.className = "flex flex-wrap gap-2 items-center standard-row fade-in mt-3";
    newRow.innerHTML = `
        <span class="w-16 shrink-0 text-center font-bold text-gray-500 bg-gray-50 py-2 rounded-md border border-gray-200">보조</span>
        <select id="course-select-${window.subStandardCount}" class="border p-2 rounded-md flex-1 min-w-[110px] text-sm bg-gray-50 font-medium" onchange="window.loadUnits(this, ${window.subStandardCount})"><option value="">과목 선택</option></select>
        <select id="unit-select-${window.subStandardCount}" class="border p-2 rounded-md flex-1 min-w-[110px] text-sm bg-gray-50 font-medium" onchange="window.loadStandards(this, ${window.subStandardCount})"><option value="">단원 선택</option></select>
        <div class="relative flex-[2] min-w-[200px]">
            <input type="text" id="std-input-${window.subStandardCount}" class="w-full border p-2 rounded-md text-sm cursor-pointer custom-select-input bg-white" readonly placeholder="이곳을 눌러 보조 성취기준 선택" onclick="window.toggleDropdown(this)">
            <ul id="std-list-${window.subStandardCount}" class="absolute z-10 w-full bg-white border mt-1 rounded-md shadow-lg hidden max-h-40 overflow-y-auto text-sm custom-select-list"></ul>
        </div>
    `;
    container.appendChild(newRow);
    window.populateCourseDropdown(window.subStandardCount);
};

// 화면 외부 클릭 시 드롭다운 닫기
document.addEventListener('click', (e) => {
    if(!e.target.classList.contains('custom-select-input')) {
        document.querySelectorAll('.custom-select-list').forEach(list => list.classList.add('hidden'));
    }
});


// 1. 유형 선택 (일반/MCP 토글)
window.selectType = function(type) {
    window.currentType = type;
    const btnGeneral = document.getElementById('btn-general');
    const btnMcp = document.getElementById('btn-mcp');
    
    if(type === 'general') {
        btnGeneral.className = "flex-1 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg border-2 border-blue-500 bg-blue-50 text-blue-700 transition-colors";
        btnMcp.className = "flex-1 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg border-2 border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors";
    } else {
        btnMcp.className = "flex-1 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg border-2 border-blue-500 bg-blue-50 text-blue-700 transition-colors";
        btnGeneral.className = "flex-1 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg border-2 border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors";
    }

    document.getElementById('section-standards').classList.remove('hidden');
    document.getElementById('section-conditions').classList.remove('hidden');
    document.getElementById('section-generate').classList.remove('hidden');
    
    // DB 로드가 아직 안됐다면 실행
    if(!window.allDbStandards || window.allDbStandards.length === 0) {
        window.initCreationDB();
    }
    
    // Linear Scale 렌더링 호출
    window.renderLevels();
};

// 2. 성취수준 Linear Scale 렌더링 (일반은 A+포함, MCP는 일반만)
window.renderLevels = function() {
    const container = document.getElementById('level-container');
    let levels = window.currentType === 'general' ? ['A+', 'A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D', 'E'];
    
    // 💡 "form-radio" 클래스는 이 프로젝트에 forms 플러그인이 없어 아무 효과가 없고,
    // 브라우저 기본 라디오 렌더링에 맡기면 기본 선택된 항목과 나머지의 크기가 기기별로 다르게 보이는 경우가 있어
    // appearance-none으로 완전히 직접 그려서 항상 동일한 크기로 보이도록 합니다.
    container.innerHTML = levels.map((lvl, idx) => `
        <label class="inline-flex items-center cursor-pointer group">
            <input type="radio" name="create-level" value="${lvl}" class="appearance-none box-border shrink-0 h-6 w-6 rounded-full border-2 border-gray-400 bg-white checked:bg-blue-600 checked:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 cursor-pointer transition-colors" ${idx===0 ? 'checked': ''}>
            <span class="ml-2 font-bold text-gray-700 text-lg group-hover:text-blue-700 transition-colors">${lvl}</span>
        </label>
    `).join('');
};

// 기타 체크박스 이벤트
document.getElementById('chk-other')?.addEventListener('change', (e) => {
    const ta = document.getElementById('create-other-textarea');
    if(e.target.checked) ta.classList.remove('hidden');
    else ta.classList.add('hidden');
});

// 클립보드 붙여넣기 (이미지)
document.getElementById('drop-zone-creation')?.addEventListener('paste', (e) => {
    // 문항 제작 탭이 열려있을 때만 이미지 붙여넣기 허용
    if(!document.getElementById('creation').classList.contains('active')) return;
    
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
        const item = items[index];
        if (item.kind === 'file') { window.handleCreationImageFile(item.getAsFile()); break; }
    }
});

window.handleCreationImageFile = function(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const dropZone = document.getElementById('drop-zone-creation');
        const previewContainer = document.getElementById('preview-container-creation');
        const previewImg = document.getElementById('preview-img-creation');
        const dropZoneText = document.getElementById('drop-zone-text');
        
        window.attachedImageBase64 = e.target.result.split(',')[1];
        window.attachedImageMime = file.type;
        
        if (dropZoneText) dropZoneText.innerHTML = "<span class='text-indigo-600 font-bold'>✓ 이미지가 성공적으로 첨부되었습니다.</span>";
        previewImg.src = e.target.result;
        previewContainer.classList.remove('hidden');
        dropZone.classList.add('bg-indigo-50', 'border-indigo-300');
        
        document.getElementById('image-options-creation').classList.remove('hidden');
        
        // 💡 [변경 완료] 이미지 첨부 시 사용자가 직관적으로 제어할 수 있도록 
        // 기본값으로 '문항 구조(형식) 가져오기'에만 체크되도록 변경합니다. (내용 복제 차단 목적)
        const structCheck = document.getElementById('img-opt-structure');
        const contentCheck = document.getElementById('img-opt-content');
        if (structCheck) structCheck.checked = true;
        if (contentCheck) contentCheck.checked = false;
    };
    reader.readAsDataURL(file);
}

document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'btn-remove-creation-image') {
        e.stopPropagation(); // 이벤트 버블링 방지
        window.attachedImageBase64 = null;
        window.attachedImageMime = null;
        
        const dropZone = document.getElementById('drop-zone-creation');
        const previewContainer = document.getElementById('preview-container-creation');
        const previewImg = document.getElementById('preview-img-creation');
        const dropZoneText = document.getElementById('drop-zone-text');
        
        if (dropZoneText) dropZoneText.innerHTML = "이곳을 클릭하거나 Ctrl+V 로 이미지를 붙여넣으세요.";
        previewImg.src = "";
        previewContainer.classList.add('hidden');
        dropZone.classList.remove('bg-indigo-50', 'border-indigo-300');
        
        document.getElementById('image-options-creation').classList.add('hidden');
    }
});

// 드롭존 클릭 시 파일 선택창 열기 연동 (X 버튼 클릭은 제외)
document.getElementById('drop-zone-creation')?.addEventListener('click', (e) => {
    if (e.target.id !== 'btn-remove-creation-image') {
        document.getElementById('file-input-creation').click();
    }
});

// 4. AI 통신 (최초 문항 생성)
window.generateQuestionAI = async function() {
    const btnGenerate = document.getElementById('btn-generate-ai');
    const loadingMsg = document.getElementById('create-loading-msg');
    
    if (!currentUser) { alert('AI 문항 제작을 사용하려면 구글 로그인을 해주세요.'); return; }
    if (!userApiKey) { document.getElementById('api-modal-overlay').classList.add('active'); return; }

    const mainStd = document.getElementById('std-input-0').value || '미분류';
    
    const subStdsArray = [];
    const subInputs = document.querySelectorAll('input[id^="std-input-"]:not(#std-input-0)');
    subInputs.forEach(input => { if(input.value) subStdsArray.push(input.value); });
    const subStdsStr = subStdsArray.length > 0 ? subStdsArray.join(', ') : '없음';

    const selectedLevelObj = document.querySelector('input[name="create-level"]:checked');
    const selectedLevel = selectedLevelObj ? selectedLevelObj.value : 'A';
    
    const isComplex = document.getElementById('chk-complex').checked;
    const isMultiple = document.getElementById('chk-multiple').checked;
    const isPic = document.getElementById('chk-pic').checked;
    const isTable = document.getElementById('chk-table').checked;
    const otherInst = document.getElementById('chk-other').checked ? document.getElementById('create-other-textarea').value : '';

    // =========================================================================
    // 💡 [프론트엔드 최적화] 위계 질서 확립 및 이미지 물리적 차단 로직
    // =========================================================================
    let finalImageBase64 = window.attachedImageBase64;
    let finalImageMime = window.attachedImageMime;
    let imageInstruction = "첨부된 이미지가 없습니다.";

    if (window.attachedImageBase64) {
        const optStruct = document.getElementById('img-opt-structure')?.checked;
        const optContent = document.getElementById('img-opt-content')?.checked;
        
        if (!optStruct && !optContent) {
            // [차단] 둘 다 체크 해제 시 이미지 데이터 전송 자체를 끊어버림
            finalImageBase64 = null;
            finalImageMime = null;
            imageInstruction = "[이미지 전송 차단됨] 사용자가 이미지를 올렸으나 반영을 거부했습니다. 오직 아래 '0순위 절대 기준'만으로 문항을 신규 창작하세요.";
        } else if (optStruct && !optContent) {
            imageInstruction = "[구조만 차용, 내용 절대 금지] 이미지 속 텍스트, 데이터, 과학적 개념은 '절대' 쓰지 마세요. 표의 형태, 그래프 레이아웃, 선지 배치 방식 등 '시각적 껍데기'만 빌려와서 내용을 완전히 0순위 타겟 성취기준으로 갈아끼우세요.";
        } else if (!optStruct && optContent) {
            imageInstruction = "[내용만 차용, 구조 변경] 이미지 속 과학적 데이터를 활용하되, 겉보기 형식은 반드시 사용자가 요청한 유형(합답형 등)으로 탈바꿈시키세요. 단, 이미지의 내용이 0순위 성취기준과 조금이라도 충돌하면 무조건 성취기준에 맞게 내용을 뜯어고치세요.";
        } else {
            imageInstruction = "[구조와 내용 모두 참고] 이미지의 형식과 데이터를 모두 활용하세요. 하지만 이 경우에도 최상위 법은 '0순위 타겟 성취기준'입니다. 어긋나는 부분은 무조건 성취기준을 따르세요.";
        }
    }

    // AI가 절대 헷갈리지 않도록 [0순위]와 [1순위]로 계급을 나누어 지시합니다.
    let conditionsText = `
    [0순위 절대 기준 - 문항 창작의 지배적 뼈대 (최우선 반영)]
    - 타겟 주성취기준: ${mainStd}
    - 타겟 보조성취기준: ${subStdsStr}
    - 목표 성취수준: ${selectedLevel} 수준
    - 문항 유형: ${window.currentType === 'mcp' ? 'MCP(최소능력자) 변별용 하한선 문항 (일반 특성 배제)' : '일반 문항'}
    - 필수 포함 요소: ${isMultiple ? '선지형' : ''} ${isComplex ? '합답형(ㄱ,ㄴ,ㄷ)' : ''} ${isPic ? '그림 제시' : ''} ${isTable ? '표 제시' : ''}
    - 추가 요청사항: ${otherInst || '없음'}

    [1순위 보조 자료 - 이미지 활용 지침 (0순위에 종속됨)]
    - ${imageInstruction}
    `;

    btnGenerate.classList.add('hidden');
    loadingMsg.classList.remove('hidden');

    try {
        // 💡 [수정] 성취기준 데이터를 직접 조립하도록 튼튼하게 변경
        let curriculumContext = window.fullCurriculumContext;
        if (!curriculumContext || curriculumContext === "데이터를 불러오는 중입니다.") {
            if (window.allDbStandards && window.allDbStandards.length > 0) {
                curriculumContext = window.allDbStandards.map(s => {
                    const lvls = s.levels || {};
                    return `[과목: ${s.course || '공통'}] 단원: ${s.unit || '미분류'}\n- 성취기준 코드: ${s.standardId || '미상'}, 내용: ${s.description || '내용 없음'}\n  [성취수준] A: ${lvls.A || '없음'}, B: ${lvls.B || '없음'}, C: ${lvls.C || '없음'}, D: ${lvls.D || '없음'}, E: ${lvls.E || '없음'}`;
                }).join('\n\n');
                window.fullCurriculumContext = curriculumContext; // 다음 번 실행을 위해 메모리에 저장
            } else {
                curriculumContext = "성취기준 데이터를 불러오지 못했습니다.";
            }
        }
        
        // 차단 로직이 적용된 finalImageBase64 변수를 Payload에 담아 전송
        const payload = {
            apiKey: userApiKey,
            type: 'create', 
            curriculumContext: curriculumContext,
            conditions: conditionsText,
            imageBase64: finalImageBase64,  
            imageMimeType: finalImageMime   
        };

        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error || '백엔드 통신 오류');

        window.appendCreationResult(data.text, `✨ AI 창작 문항 (버전 ${++window.resultCounter})`, mainStd, selectedLevel);
        
    } catch (error) {
        console.error(error);
        alert(`제작 실패: ${error.message}`);
    } finally {
        btnGenerate.classList.remove('hidden');
        loadingMsg.classList.add('hidden');
    }
};

// 5. 창작 결과물 화면 출력
window.appendCreationResult = function(htmlContent, titleText, stdId, level) {
    const container = document.getElementById('results-container');
    const idSuffix = window.resultCounter;
    
    window.extractDataToState(htmlContent);

    // 💡 [핵심 수정] 문항이 생성되자마자 즉시 "프린트 출력 대기열"에 자동 추가합니다! (DB 저장 유무 무관)
    const qText = window.currentAnalysisState.question || "문항 텍스트 없음";
    const qSvg = window.currentAnalysisState.svg || "";
    const qConditions = window.currentAnalysisState.conditions || [];
    const qOptions = window.currentAnalysisState.options || [];
    const qLevel = level.replace('+', ''); 
    
    let printHtml = `<div style="margin-bottom: 8px;"><strong>[성취수준 ${qLevel}]</strong><br>${qText.replace(/\n/g, '<br>')}</div>`;
    
    if (qSvg) {
        printHtml += `<div style="display:flex; justify-content:center; margin: 15px 0;">${qSvg}</div>`;
    }
    
    if (qConditions.length > 0) {
        const { presentation, bogi } = splitConditions(qConditions);
        printHtml += `<div style="border: 1px solid #777; padding: 15px; margin: 15px 0; border-radius: 4px; line-height: 1.6; font-size: 0.95rem; background-color: #fff;">`;
        if (presentation.length > 0) {
            printHtml += `<div style="${bogi.length > 0 ? 'margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #999;' : ''}">`;
            presentation.forEach(p => { printHtml += `<div style="margin-bottom: 8px;">${p.replace(/\n/g, '<br>')}</div>`; });
            printHtml += `</div>`;
        }
        if (bogi.length > 0) {
            printHtml += `<div style="font-weight:bold; text-align:center; margin-bottom: 8px;">&lt;보 기&gt;</div>`;
            bogi.forEach(cond => { printHtml += `<div style="margin-bottom: 8px;">${cond.replace(/\n/g, '<br>')}</div>`; });
        }
        printHtml += `</div>`;
    }

    if (qOptions.length > 0) {
        // 💡 ㄱ,ㄴ,ㄷ 합답형처럼 선지가 짧으면(평가원 스타일) 한 줄로 이어 붙여 공간을 절약하고,
        // 문장형 선지처럼 길면 기존처럼 한 줄에 하나씩 세로로 배치합니다.
        const isCompact = qOptions.every(opt => opt.replace(/\s/g, '').length <= 10);
        const optionsStyle = isCompact
            ? 'display:flex; flex-wrap:wrap; gap:6px 20px;'
            : 'display:flex; flex-direction:column; gap:6px;';
        printHtml += `<div style="${optionsStyle} margin-top:10px;">
            ${qOptions.map((opt, i) => `<span style="${isCompact ? 'white-space:nowrap;' : ''}">${['①','②','③','④','⑤'][i]} ${opt}</span>`).join('')}
        </div>`;
    }
    
    // 글로벌 프린트 배열에 객체 형태로 저장 (기본적으로 선택되도록 설정)
    window.printList.push({ id: idSuffix, html: printHtml, selected: true });
    
    // 출력 섹션 보여주기 및 UI 업데이트
    document.getElementById('section-print').classList.remove('hidden');
    window.updatePrintSelectionUI();

    // 화면 그리기
    const block = document.createElement('div');
    block.className = "bg-white p-8 rounded-xl shadow-lg border border-gray-200 w-full max-w-4xl fade-in relative";
    block.id = `creation-block-${idSuffix}`;
    block.dataset.htmlContent = encodeURIComponent(htmlContent);

    block.innerHTML = `
        <h3 class="text-xl font-extrabold mb-4 text-blue-800 flex items-center gap-2">${titleText}</h3>
        <div id="q-content-${idSuffix}" class="p-6 rounded-lg bg-gray-50 border-2 border-transparent transition-colors" onmouseup="window.handleTextDrag(${idSuffix})">${htmlContent}</div>

        <div id="edit-controls-${idSuffix}" class="mt-4 hidden bg-indigo-50 p-5 rounded-lg border border-indigo-100 shadow-inner">
            <p class="text-sm text-indigo-800 font-bold mb-3">✏️ 위 박스 안에서 수정하고 싶은 텍스트(또는 표/그래프 일부)를 마우스로 드래그하세요.</p>
            <div id="edit-rows-container-${idSuffix}" class="flex flex-col gap-3 mb-4"></div>
            <button id="btn-apply-edit-${idSuffix}" class="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-md shadow-md transition-transform hover:-translate-y-1" onclick="window.applyEdit(${idSuffix})">
                ✨ 작성된 모든 요청사항을 종합하여 새 버전 만들기
            </button>
        </div>

        <div class="mt-8 pt-6 border-t border-gray-200 flex justify-center space-x-4">
            <button class="bg-white border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-50 font-bold py-3 px-6 rounded-lg transition-colors" onclick="window.enableEditMode(${idSuffix})">
                ✏️ 문항 수정하기(+)
            </button>
            <button class="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-transform hover:-translate-y-1" onclick="window.saveCreationToDB(${idSuffix}, '${level}')">
                💾 이 문항을 DB에 반영하기
            </button>
        </div>
    `;

    container.appendChild(block);
    
    if(window.MathJax) MathJax.typesetPromise([block]).catch(console.error);
    setTimeout(() => block.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
};

// 6. 드래그 수정 기능 활성화
window.enableEditMode = function(idSuffix) {
    window.isEditingMode = true;
    window.activeTargetId = idSuffix;
    
    const contentDiv = document.getElementById(`q-content-${idSuffix}`);
    contentDiv.classList.add('bg-green-50', 'border-green-300', 'cursor-text'); // 옅은 녹색 음영 처리
    document.getElementById(`edit-controls-${idSuffix}`).classList.remove('hidden');
    
    window.addEditRow(idSuffix);
};

window.addEditRow = function(idSuffix) {
    const container = document.getElementById(`edit-rows-container-${idSuffix}`);
    const rowId = Date.now();
    const rowHtml = `
        <div class="edit-row flex space-x-2 items-center fade-in bg-white p-2 rounded border border-indigo-200" id="edit-row-${rowId}">
            <input type="text" class="edit-source border p-2 rounded flex-1 text-sm bg-gray-50 text-gray-600 font-medium" placeholder="드래그된 원본 텍스트..." readonly>
            <button onclick="document.getElementById('edit-row-${rowId}').remove()" class="bg-red-100 text-red-600 px-3 py-2 rounded font-bold hover:bg-red-200 transition-colors" title="이 요청 취소">✕</button>
            <span class="text-indigo-400 font-bold">➡️</span>
            <input type="text" class="edit-req border border-indigo-300 p-2 rounded flex-[2] text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-bold" placeholder="수정 요청사항 입력 (예: 이 문장을 짧게 줄여줘)">
        </div>
    `;
    container.insertAdjacentHTML('beforeend', rowHtml);
};

// 7. 텍스트 드래그 캡처
window.handleTextDrag = function(idSuffix) {
    if (!window.isEditingMode || window.activeTargetId !== idSuffix) return;
    let selectedText = window.getSelection().toString().trim();
    
    if (selectedText) {
        const container = document.getElementById(`edit-rows-container-${idSuffix}`);
        const rows = container.querySelectorAll('.edit-row');
        
        if (rows.length > 0) {
            const lastRow = rows[rows.length - 1];
            const lastSource = lastRow.querySelector('.edit-source');
            if (!lastSource.value) {
                lastSource.value = selectedText;
                lastRow.querySelector('.edit-req').focus();
            } else {
                window.addEditRow(idSuffix);
                const newRows = container.querySelectorAll('.edit-row');
                newRows[newRows.length - 1].querySelector('.edit-source').value = selectedText;
                newRows[newRows.length - 1].querySelector('.edit-req').focus();
            }
        } else {
            window.addEditRow(idSuffix);
            container.querySelector('.edit-source').value = selectedText;
            container.querySelector('.edit-req').focus();
        }
    }
};

// 8. 다중 수정 요청 처리
window.applyEdit = async function(idSuffix) {
    const container = document.getElementById(`edit-rows-container-${idSuffix}`);
    const rows = container.querySelectorAll('.edit-row');
    let instructions = [];
    
    rows.forEach(r => {
        const src = r.querySelector('.edit-source').value.trim();
        const req = r.querySelector('.edit-req').value.trim();
        if (req) instructions.push(`- 대상 원본: "${src}"\n- 지시사항: "${req}"`);
    });

    if (instructions.length === 0) { alert("최소 한 개 이상의 수정 요청사항을 입력해주세요."); return; }

    const combinedInstruction = instructions.join('\n\n');
    const btn = document.getElementById(`btn-apply-edit-${idSuffix}`);
    btn.textContent = "⏳ 여러 요청사항을 종합하여 문항을 수정 중입니다...";
    btn.disabled = true;

    try {
        const block = document.getElementById(`creation-block-${idSuffix}`);
        const previousHtml = decodeURIComponent(block.dataset.htmlContent);

        const payload = {
            apiKey: userApiKey,
            type: 'edit',
            previousHtml: previousHtml,
            targetText: "다중 수정 진행됨",
            instruction: combinedInstruction
        };

        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        window.isEditingMode = false;
        const contentDiv = document.getElementById(`q-content-${idSuffix}`);
        contentDiv.classList.remove('bg-green-50', 'border-green-300', 'cursor-text');
        document.getElementById(`edit-controls-${idSuffix}`).classList.add('hidden');
        btn.textContent = "✨ 작성된 모든 요청사항을 종합하여 새 버전 만들기";
        btn.disabled = false;

        const newLevelObj = document.querySelector('input[name="create-level"]:checked');
        const newLevel = newLevelObj ? newLevelObj.value : 'A';
        window.appendCreationResult(data.text, `✍️ 종합 수정된 문항 (버전 ${++window.resultCounter})`, '수정본', newLevel);

    } catch (error) {
        console.error(error);
        alert(`수정 실패: ${error.message}`);
        btn.textContent = "✨ 작성된 모든 요청사항을 종합하여 새 버전 만들기";
        btn.disabled = false;
    }
};

window.printList = window.printList || [];

// 💡 [추가] 프린트할 문항을 체크박스로 그리는 UI 함수
window.updatePrintSelectionUI = function() {
    const container = document.getElementById('print-selection-container');
    if(!container) return; 
    
    container.innerHTML = window.printList.map((item, idx) => `
        <label class="flex items-center gap-2 px-4 py-2 border rounded-full cursor-pointer transition-colors ${item.selected ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-gray-200'}">
            <input type="checkbox" class="form-checkbox text-blue-600 h-5 w-5" ${item.selected ? 'checked' : ''} onchange="window.togglePrintSelection(${idx}, this.checked)">
            <span class="font-bold ${item.selected ? 'text-blue-800' : 'text-gray-600'}">문항 버전 ${idx + 1}</span>
        </label>
    `).join('');
    document.getElementById('print-count').innerText = window.printList.filter(i => i.selected).length;
};

// 체크박스 클릭 시 상태 업데이트
window.togglePrintSelection = function(idx, isChecked) {
    window.printList[idx].selected = isChecked;
    window.updatePrintSelectionUI();
};

// 9. DB 저장 버튼 로직 (프린트 배열 넣는 기능은 위로 올라갔으므로 삭제)
window.saveCreationToDB = function(idSuffix, rawLevel) {
    const block = document.getElementById(`creation-block-${idSuffix}`);
    const htmlContent = decodeURIComponent(block.dataset.htmlContent);
    window.extractDataToState(htmlContent);

    const qLevel = rawLevel.replace('+', ''); 

    document.getElementById('save-std-id').value = window.currentAnalysisState.mainStd;
    document.getElementById('save-level').value = qLevel; 
    
    const qTextArea = document.getElementById('save-question-text');
    if (qTextArea) qTextArea.value = window.currentAnalysisState.question;
    const aText = document.getElementById('save-correct-answer');
    if (aText) aText.value = window.currentAnalysisState.answer;

    let subStdInput = document.getElementById('save-sub-stds');
    if (!subStdInput) {
        const mainStdInput = document.getElementById('save-std-id');
        subStdInput = document.createElement('input');
        subStdInput.id = 'save-sub-stds';
        subStdInput.type = 'text';
        subStdInput.style.marginTop = '10px';
        subStdInput.placeholder = '보조성취기준 (쉼표로 구분)';
        mainStdInput.parentNode.insertBefore(subStdInput, mainStdInput.nextSibling);
    }
    subStdInput.value = window.currentAnalysisState.subStds === '없음' ? '' : window.currentAnalysisState.subStds;

    document.getElementById('save-modal-overlay').classList.add('active');
};

// 9.5. 선택한 문항을 워드(.doc) 파일로 저장 (필수탐구활동 탭의 저장하기 기능과 동일한 방식)
window.downloadCreationTest = async function() {
    const selectedItems = window.printList.filter(item => item.selected);
    if (selectedItems.length === 0) return alert("저장할 문항을 하나 이상 선택해주세요.");

    // Word는 인라인 SVG를 제대로 표시하지 못하므로, 문항 안의 SVG를 PNG 이미지로 바꿔치기합니다.
    const itemsHtml = await Promise.all(selectedItems.map(async (item, idx) => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = item.html;
        const svgs = wrapper.querySelectorAll('svg');
        for (const svg of svgs) {
            try {
                const pngDataUrl = await svgToPngDataUrl(svg.outerHTML);
                const img = document.createElement('img');
                img.src = pngDataUrl;
                img.style.maxWidth = '500px';
                svg.replaceWith(img);
            } catch (e) {
                console.error('SVG 변환 실패:', e);
            }
        }
        return `<div style="margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #ccc;"><p style="font-weight:bold; font-size: 12pt; margin-bottom: 8px;">${idx + 1}번.</p>${wrapper.innerHTML}</div>`;
    }));

    const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
        <meta charset="utf-8">
        <title>과학 탐구 평가 시험지</title>
        <style>
            body { font-family: '맑은 고딕', sans-serif; font-size: 11pt; line-height: 1.7; color:#111; }
            h1 { font-size: 16pt; text-align:center; margin: 0 0 20px; border-bottom: 2px solid #111; padding-bottom: 10px; }
        </style>
    </head>
    <body>
        <h1>과학 탐구 평가 시험지</h1>
        ${itemsHtml.join('')}
    </body>
    </html>`;

    const blob = new Blob(["﻿", htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `과학_탐구_평가_시험지.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// 10. 시험지 출력 (평가원 스타일 2단 편집)
window.printTest = function() {
    // 체크박스로 선택된 문항만 필터링합니다.
    const selectedItems = window.printList.filter(item => item.selected);
    if (selectedItems.length === 0) return alert("출력할 문항을 하나 이상 선택해주세요.");
    
    let printWindow = window.open('', '_blank');
    let content = `
    <html>
    <head>
        <title>AI 생성 과학 시험지</title>
        <script>
            window.MathJax = { tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']], displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']] } };
        </script>
        <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
        <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Noto Sans KR', sans-serif; line-height: 1.6; padding: 0; margin: 0; color: #111; font-size: 11pt; }

            /* 💡 평가원 모의고사 스타일 2단 편집(다단 흐름).
               제목(h2)을 다단 컨테이너 "밖" 형제 요소로 두면, 크롬이 인쇄 시 다단 내용을
               통째로 다음 페이지로 밀어버려 1페이지가 비는 현상이 있었습니다(내용 길이와
               무관하게 재현됨 — 콘텐츠가 한 페이지에 다 들어가는 경우에도 발생).
               제목을 다단 컨테이너 "안"의 첫 자식으로 옮기고 column-span: all을 지정하는
               것이 여러 단 레이아웃에서 제목을 넣는 CSS 표준 방식이며, 이 문제를 피합니다. */
            .test-paper {
                column-count: 2;
                column-gap: 12mm;
                column-fill: auto;
            }
            .test-paper > h2 {
                column-span: all;
                text-align: center;
                margin: 0 0 20px;
                border-bottom: 2px solid #111;
                padding-bottom: 10px;
                font-size: 1.5rem;
            }
            .q-item {
                margin-bottom: 20px;
                padding-bottom: 15px;
                break-inside: avoid;      /* 문항이 단 사이에서 찢어지지 않도록 보호(가능한 경우) */
                page-break-inside: avoid;
                max-width: 100%;
                overflow-wrap: break-word;
            }
            /* 💡 표나 긴 영어/염기서열 문자열이 단 너비보다 넓으면 단 경계를 넘어가면서
               왼쪽 단이 실제보다 좁아 보이는 것처럼 보이는 원인이 됩니다. 항상 단 너비 안에
               맞도록 강제합니다. */
            .q-item table { width: 100% !important; table-layout: fixed; }
            .q-item td, .q-item th { word-break: break-word; overflow-wrap: break-word; }
            .q-item img, .q-item svg { max-width: 100%; height: auto; }
        </style>
    </head>
    <body>
        <div class="test-paper">
            <h2>과학 탐구 평가 시험지</h2>
    `;

    selectedItems.forEach((item, idx) => {
        content += `<div class="q-item"><strong style="font-size: 1.1rem; margin-right: 8px;">${idx + 1}번.</strong>${item.html}</div>`;
    });

    content += `
        </div>`;

    content += `
        <script>
            window.onload = function() {
                // MathJax가 수식을 다 그릴 수 있도록 1.5초 대기 후 인쇄
                setTimeout(function() { window.print(); }, 1500); 
            };
        </script>
    </body>
    </html>`;
    
    printWindow.document.write(content);
    printWindow.document.close();
};

// 11. 초기화
window.resetCreationForm = function() {
    if (confirm("모든 작업 내역(출력 대기열 포함)이 초기화됩니다. 계속하시겠습니까?")) {
        document.getElementById('results-container').innerHTML = '';
        document.getElementById('section-print').classList.add('hidden');
        window.printList = []; 
        document.getElementById('print-count').innerText = "0";
        window.updatePrintSelectionUI();
        window.resultCounter = 0;
        
        // 이미지 첨부 내역도 초기화
        window.attachedImageBase64 = null;
        window.attachedImageMime = null;
        document.getElementById('drop-zone-creation').innerHTML = `
            이곳을 클릭하거나 Ctrl+V 로 이미지를 붙여넣으세요.
            <img id="preview-img-creation" src="" class="hidden mt-3 max-h-32 mx-auto rounded-md shadow-sm border border-gray-200">
        `;
        document.getElementById('drop-zone-creation').classList.remove('bg-indigo-50', 'border-indigo-300');
        document.getElementById('image-options-creation').classList.add('hidden');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};