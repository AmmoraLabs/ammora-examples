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

**별도 Ammora 승인 없이 가능한 범위:** SDK 설치·조회, 본인 소유의 유효한 Config 생성, 이미 지원·활성화된 경로의 토큰 발행·거래·Graduation·풀 생성·권한 있는 수수료 청구를 진행할 수 있습니다. 외부 수익원은 이미 활성화된 표준에 정확히 부합하는 새 인스턴스라면 필요한 소유자·수익권자의 동의와 등록 타임락을 거쳐 직접 연결할 수 있습니다. 예제의 합성 테스트 표준이 임의의 실제 토큰·외부 구현까지 지원한다는 의미는 아닙니다.

**파트너가 준비할 항목:** 본인 지갑과 실제 권한자의 동의, 가스용 ETH, 거래·유동성용 토큰, 수령자 주소와 선택한 배포의 설정입니다. ETH와 WETH 잔액은 별도입니다. 지갑 서명·토큰 사용 승인·위임과 필요한 타임락은 충족해야 하며, 이는 Ammora의 고객별 가입 승인이 아닙니다.

**별도 검토·권한이 필요한 경우:** 미지원 토큰·구현·네트워크, 제한된 토큰 정책 변경, 새로운 helper·preset·외부 수익원 표준 추가 등이 해당합니다. 기존 외부 모듈의 수익권 변경이나 중지 후 복구도 지정된 거버넌스·권한자의 동의가 필요합니다. 지원되는 일반 FeeVault/LP 수수료 위임은 해당 수익권자의 권한으로 진행합니다. 일반 풀의 토큰 등록이 곧 런치·집계 경로의 자산 허용을 뜻하지는 않습니다.

상세 조건은 [승인·검토 기준](https://docs.ammora.org/guides/permissions)을 확인해주세요. 공개 API·Indexer 연동 없이 컨트랙트 중심으로 시작할 수 있습니다. 이 안내는 GIWA 테스트넷 기준이며 실제 발행사 지원·메인넷 운영·공개 앱 노출은 별도 확인 대상입니다.
