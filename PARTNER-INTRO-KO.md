# 파트너 연동 안내 — SDK 0.3.9 (한국어)

안녕하세요. Ammora SDK **0.3.9 / GIWA Sepolia 테스트넷(체인 ID 91342)** 연동 자료를 공유드립니다.

- [공개 예제 저장소](https://github.com/AmmoraLabs/ammora-examples)
- [파트너 빠른 시작](https://docs.ammora.org/guides/partner-quickstart)
- [런치패드: Config → 발행 → 거래 → Graduation → 청구](https://docs.ammora.org/guides/launchpad)
- [에이전트 기반 발행·거래](https://docs.ammora.org/guides/agent-launchpad)
- [스테이블코인 풀 연동](https://docs.ammora.org/guides/stablecoin-quickstart)
- [수수료 분배·Creator/Partner·LP 위임 청구](https://docs.ammora.org/guides/fee-sharing)
- [외부 수익원 연결](https://docs.ammora.org/guides/self-service)
- [토큰 베스팅](https://docs.ammora.org/guides/vesting)

## 처음 시작하는 순서

1. **Node 24.18.0**과 Git을 준비하고, 아래 설치를 새 디렉터리에서 한 번만 진행하세요. SDK만 `npm install`하면 이 저장소의 `npm run` 예제 명령은 생기지 않습니다.
2. 아래 표에서 **자기 제품에 해당하는 경로 하나**를 선택하세요. 기존 스테이블코인의 풀을 만드는 팀은 런치패드 Config 생성·새 토큰 발행·Graduation을 거치지 않습니다.
3. 가이드의 주소·수량·역할을 자기 팀 값으로 채운 뒤 조회와 미서명 준비부터 진행하세요. 제품 가이드는 영문이며 예제는 같은 저장소의 루트에서 실행합니다.

```bash
git clone https://github.com/AmmoraLabs/ammora-examples.git
cd ammora-examples
node --version  # v24.18.0 기준; nvm 사용자는 nvm use
npm ci --ignore-scripts
cp .env.giwa.example .env  # 새 복제본에서만; 기존 설정 파일을 덮어쓰지 마세요

# 기존 셸 변수가 .env보다 우선하므로 테스트넷 값도 맞춥니다.
export AMMORA_CHAIN_ID=91342
export AMMORA_GIWA_GENERATION=auto-route
export AMMORA_RPC_URL=https://sepolia-rpc.giwa.io
export AMMORA_RPC_INTERVAL_MS=600
export AMMORA_READ_RECEIPT=''
export AMMORA_SEND=0
```

| 만들려는 제품 | 시작할 가이드·예제 | 다음 단계와 자기 팀이 채울 값 |
| --- | --- | --- |
| 새 토큰을 발행하는 런치패드 | [런치패드 가이드](https://docs.ammora.org/guides/launchpad) · [배포 조회 예제](https://docs.ammora.org/examples?command=quickstart%3Averify): `npm run quickstart:verify` | 가이드 2–9절: 실제 Config 소유자·수수료 수령자·공급량·quote 예산 → Config → 발행·거래 → Graduation → 청구. 기본 경로는 auto-route V4/Concentrated입니다. |
| 토큰을 발행·거래하는 에이전트 | 먼저 [에이전트 빠른 시작](https://docs.ammora.org/guides/agent-quickstart) · [도구 조회 예제](https://docs.ammora.org/examples?command=agent%3Atools): `npm run agent:tools` | [연결 가이드](https://docs.ammora.org/guides/agent-launchpad) 1–3절 후 11절: 자기 policy·허용 Config·예산·저널·지갑 연결. 도구 목록/CLI에는 자동 서명자가 없고, 실제 송신은 인증된 호스트가 연결합니다. |
| 이미 GIWA에 발행된 스테이블코인의 풀 | [스테이블코인 가이드](https://docs.ammora.org/guides/stablecoin-quickstart) 2–4절 · [미서명 planner](https://docs.ammora.org/examples?file=extensions%2Falmm-unified%2Fplan.ts)의 `policy` | 실제 토큰·decimals·LP·feeOwner·지급 주소와 한도를 manifest에 입력한 뒤, 가이드가 정의하는 `plan policy …`로 시작합니다. `giwa-almm-unified-v1`은 별도 opt-in profile이며 합성 토큰·기존 NFT를 자기 자산으로 복사하지 않습니다. |
| Creator·Partner·LP·팀 수수료 분배 | [수수료 가이드](https://docs.ammora.org/guides/fee-sharing) · [분배 미리보기 예제](https://docs.ammora.org/examples?command=launch%3Afee-config) | 신규 Config면 2–3절의 `preview`에 자기 수령자·비율·공급량·임계값을 입력합니다. 이미 발생한 수수료는 실제 자산·수익권자·포지션으로 4–6절을 따릅니다. 별도 지급 주소는 청구 권한을 얻지 않습니다. |
| 호환 외부 수익원 연결 | [외부 수익원 가이드](https://docs.ammora.org/guides/self-service) · [표준 조회 예제](https://docs.ammora.org/examples?command=partner%3Astandards): `npm run partner:standards -- profile.json` | 먼저 가이드대로 검토된 profile을 준비합니다. 실제 소스·controller·수익권자 동의·runtime 일치가 필요합니다. 이 CLI는 미서명 요청/대사만 하므로 배포·동의·등록·거래·청구 송신은 자기 앱의 지갑·저널로 연결해야 합니다. |
| 팀·투자자 토큰 베스팅 | [베스팅 가이드](https://docs.ammora.org/guides/vesting) · [오프라인 배분 예제](https://docs.ammora.org/examples?command=launch%3Avesting-config): `npm run launch:vesting-config -- src/vesting/allocation.example.json` | 샘플 계산은 자금을 잠그지 않습니다. 실제 생성에는 지원 토큰·수령자·raw 수량·일정을 자기 값으로 채웁니다. 가이드의 관찰용 완료 lock은 새 파트너가 청구할 자산이 아닙니다. |

이 표는 경로 선택용입니다. 실제 인자와 JSON은 해당 가이드의 코드 블록을 따르세요. 이미 설치한 프로젝트에서는 다른 가이드의 새 프로젝트 설치를 다시 수행하거나 `.env`를 덮어쓰지 마세요. LP/FeeVault/외부 모듈은 서로 다른 수수료 권한과 지급 규칙을 사용합니다.

`AMMORA_SEND=0`이 모든 송신 전용 명령을 미리보기로 바꾸지는 않습니다. 미지원·권한 부족·잔액 부족이 나오면 원인을 확인하고, placeholder나 다른 팀의 Config·토큰·포지션을 실제 입력으로 사용하지 마세요. 키는 자기 앱의 지갑 연결 또는 비공개 실행 환경에만 두고 소스·프런트엔드·문서에 넣지 마세요. 실제 송신은 선택한 단계만 한 번 실행하고 hash·canonical receipt·이벤트·지급 잔액을 확인한 뒤 다음 단계로 진행합니다.

**별도 Ammora 승인 없이 가능한 범위:** SDK 설치·조회, 본인 소유의 유효한 Config 생성, 이미 지원·활성화된 경로의 토큰 발행·거래·Graduation·풀 생성·권한 있는 수수료 청구를 진행할 수 있습니다. 외부 수익원은 이미 활성화된 표준에 정확히 부합하는 새 인스턴스라면 필요한 소유자·수익권자의 동의와 등록 타임락을 거쳐 직접 연결할 수 있습니다. 예제의 합성 테스트 표준이 임의의 실제 토큰·외부 구현까지 지원한다는 의미는 아닙니다.

**파트너가 준비할 항목:** 본인 지갑과 실제 권한자의 동의, 가스용 ETH, 거래·유동성용 토큰, 수령자 주소와 선택한 배포의 설정입니다. ETH와 WETH 잔액은 별도입니다. 지갑 서명·토큰 사용 승인·위임과 필요한 타임락은 충족해야 하며, 이는 Ammora의 고객별 가입 승인이 아닙니다.

**별도 검토·권한이 필요한 경우:** 미지원 토큰·구현·네트워크, 제한된 토큰 정책 변경, 새로운 helper·preset·외부 수익원 표준 추가 등이 해당합니다. 기존 외부 모듈의 수익권 변경이나 중지 후 복구도 지정된 거버넌스·권한자의 동의가 필요합니다. 지원되는 일반 FeeVault/LP 수수료 위임은 해당 수익권자의 권한으로 진행합니다. 일반 풀의 토큰 등록이 곧 런치·집계 경로의 자산 허용을 뜻하지는 않습니다.

상세 조건은 [승인·검토 기준](https://docs.ammora.org/guides/permissions)을 확인해주세요. 공개 API·Indexer 연동 없이 컨트랙트 중심으로 시작할 수 있습니다. 이 안내는 GIWA 테스트넷 기준이며 실제 발행사 지원·메인넷 운영·공개 앱 노출은 별도 확인 대상입니다.

최종 [온보딩 점검 결과](https://docs.ammora.org/guides/docs-partner-onboarding-review)는 문서·예제 연결 검사와 기존 GIWA 검증의 재사용 범위를 구분합니다. 새 파트너의 자산·권한·잔액을 새로 검증했다는 뜻은 아닙니다.

[새 프로젝트의 SDK 0.3.9 실제 GIWA 실행 결과](https://docs.ammora.org/guides/docs-fresh-partner-giwa-039): 새 Config·발행·졸업 전후 거래·실제 수수료 지급과 승인 회수 18건을 확인했습니다. 스테이블코인·외부 수익원·베스팅·기존 위임 지급은 새 조회/계획 실행과 과거 유효한 온체인 검증 재사용을 구분했습니다. 다른 팀의 테스트 자산·NFT를 자기 입력으로 복사하지 마세요.
