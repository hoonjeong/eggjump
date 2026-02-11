---
url: 'https://developers-apps-in-toss.toss.im/tutorials/webview.md'
description: 앱인토스 미니앱을 WebView로 개발 시작할 때 사용하는 튜토리얼입니다. WebView로 프로젝트를 스캐폴딩하는 방법들을 담고 있습니다.
---

# WebView

::: details 새 웹 프로젝트를 시작하시나요?
이 가이드에서는 이해를 돕기 위해 **Vite(React + TypeScript)** 기준으로 설명합니다.\
다른 빌드 환경을 사용하셔도 괜찮아요.

:::code-group

```bash[npm]
npm create vite@latest {project명} -- --template react-ts
cd {project명}
npm install
npm run dev
```

```bash[yarn]
yarn create vite {project명} --template react-ts
cd {project명}
yarn
yarn dev
```

```bash[pnpm]
pnpm create vite@latest {project명} --template react-ts
cd {project명}
pnpm install
pnpm dev
```

기존 웹 서비스가 이미 있으시다면, 아래 가이드에 따라 `@apps-in-toss/web-framework`를 설치해주세요.

:::

기존 웹 프로젝트에 `@apps-in-toss/web-framework`를 설치하면 앱인토스 샌드박스에서 바로 개발하고 배포할 수 있어요.

## 설치하기

기존 웹 프로젝트에 아래 명령어 중 사용하는 패키지 매니저에 맞는 명령어를 실행하세요.

::: code-group

```sh [npm]
npm install @apps-in-toss/web-framework
```

```sh [pnpm]
pnpm install @apps-in-toss/web-framework
```

```sh [yarn]
yarn add @apps-in-toss/web-framework
```

:::

## 환경 구성하기

`ait init` 명령어를 실행해 환경을 구성할 수 있어요.

1. `ait init` 명령어를 실행하세요.

::: code-group

```sh [npm]
npx ait init
```

```sh [pnpm]
pnpm ait init
```

```sh [yarn]
yarn ait init
```

:::

::: tip Cannot set properties of undefined (setting 'dev') 오류가 발생한다면?

package.json scripts 필드의 dev 필드에, 원래 사용하던 번들러의 개발 모드를 띄우는 커맨드를 입력 후 다시 시도해주세요.

:::

2. `web-framework`를 선택하세요.
3. 앱 이름(`appName`)을 입력하세요.

::: tip appName 입력 시 주의하세요

* 이 이름은 앱인토스 콘솔에서 앱을 만들 때 사용한 이름과 같아야 해요.
* 앱 이름은 각 앱을 식별하는 **고유한 키**로 사용돼요.
* appName은 `intoss://{appName}/path` 형태의 딥링크 경로나 테스트·배포 시 사용하는 앱 전용 주소 등에서도 사용돼요.
* 샌드박스 앱에서 테스트할 때도 `intoss://{appName}`으로 접근해요.\
  단, 출시하기 메뉴의 QR 코드로 테스트할 때는 `intoss-private://{appName}`이 사용돼요.
  :::

4. 웹 번들러의 dev 명령어를 입력해주세요.
5. 웹 번들러의 build 명령어를 입력해주세요.
6. 웹 개발 서버에서 사용할 포트 번호를 입력하세요.

### 설정 파일 확인하기

설정을 완료하면 설정 파일인 `granite.config.ts` 파일이 생성돼요.\
자세한 설정 방법은 [공통 설정](/bedrock/reference/framework/UI/Config.html) 문서를 확인해 주세요.

::: code-group

```ts [granite.config.ts]
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'ping-pong', // 앱인토스 콘솔에서 설정한 앱 이름
  brand: {
    displayName: '%%appName%%', // 화면에 노출될 앱의 한글 이름으로 바꿔주세요.
    primaryColor: '#3182F6', // 화면에 노출될 앱의 기본 색상으로 바꿔주세요.
    icon: https://static.toss.im/appsintoss/0000/granite.png, // 콘솔에서 업로드한 이미지의 URL(콘솔의 앱 정보에서 업로드한 이미지를 우클릭해 링크 복사 후 넣어주세요)
  },
  web: {
    host: 'localhost', // 앱 내 웹뷰에 사용될 host
    port: 5173,
    commands: {
      dev: 'vite', // 개발 모드 실행 (webpack serve도 가능)
      build: 'vite build', // 빌드 명령어 (webpack도 가능)
    },
  },
  permissions: [],
});
```

:::

* `brand`: 앱 브랜드와 관련된 구성이에요.
  * `displayName`: 브릿지 뷰에 표시할 앱 이름이에요. 미니앱 이름과 동일하게 넣어주세요.
  * `icon`: 앱의 로고 이미지 URL을 입력해 주세요. 콘솔의 앱 정보에서 업로드한 이미지를 우클릭해 링크 복사 후 넣어 주세요.
  * `primaryColor`: Toss 디자인 시스템(TDS) 컴포넌트에서 사용할 대표 색상이에요. RGB HEX 형식(eg. `#3182F6`)으로 지정해요.
* `web.commands.dev` 필드는 `granite dev` 명령어 실행 시 함께 실행할 명령어예요. 번들러의 개발 모드를 시작하는 명령어를 입력해주세요.
* `web.commands.build` 필드는 `granite build` 명령어 실행 시 함께 실행할 명령어예요. 번들러의 빌드 명령어를 입력해주세요.
* `webViewProps.type` 미니앱에 맞게 내비게이션 바를 설정할 수 있어요.
  * `partner`: 비게임 파트너사 콘텐츠에 사용하는 기본 웹뷰예요. 다른 값을 설정하지 않으면 이 값이 기본으로 사용돼요.
  * `game`: 게임 미니앱에서 사용해요.

::: tip 웹 빌드 시 주의사항

`granite build`를 실행하면 `web.commands.build`가 실행되고, 이 과정에서 생성된 결과물을 바탕으로 `.ait` 파일을 만들어요. `web.commands.build`의 결과물은 `granite.config.ts`의 `outdir` 경로와 같아야 해요.

`outdir`의 기본값은 프로젝트 경로의 `dist` 폴더지만, 필요하면 `granite.config.ts`에서 수정할 수 있어요. 만약 빌드 결과물이 `outdir`과 다른 경로에 저장되면 배포가 정상적으로 이루어지지 않을 수 있으니 주의하세요.

:::

### WebView TDS 패키지 설치하기

**TDS (Toss Design System)** 패키지는 웹뷰 기반 미니앱이 일관된 UI/UX를 유지하도록 돕는 토스의 디자인 시스템이에요.\
`@apps-in-toss/web-framework`를 사용하려면 TDS WebView 패키지를 추가로 설치해야 해요.\
모든 비게임 WebView 미니앱은 TDS 사용이 필수이며, 검수 승인 기준에도 포함돼요.

| @apps-in-toss/web-framework 버전 | 사용할 패키지              |
| -------------------------------- | -------------------------- |
| < 1.0.0                          | @toss-design-system/mobile |
| >= 1.0.0                         | @toss/tds-mobile           |

TDS에 대한 자세한 가이드는 [WebView TDS](https://tossmini-docs.toss.im/tds-mobile/)를 참고해주세요.

:::tip TDS 테스트
로컬 브라우저에서는 TDS가 동작하지 않아, 테스트할 수 없어요.\
번거로우시더라도 [샌드박스앱](/development/test/sandbox)을 통한 테스트를 부탁드려요.
:::

## 서버 실행하기

### 로컬 개발 서버 실행하기

로컬 개발 서버를 실행하면 웹 개발 서버와 React Native 개발 서버가 함께 실행돼요.
웹 개발 서버는 `granite.config.ts` 파일의 `web.commands.dev` 필드에 설정한 명령어를 사용해 실행돼요.

또, HMR(Hot Module Replacement)을 지원해서 코드 변경 사항을 실시간으로 반영할 수 있어요.

다음은 개발 서버를 실행하는 명령어에요.

Granite으로 스캐폴딩된 서비스는 `dev` 스크립트를 사용해서 로컬 서버를 실행할 수 있어요. 서비스의 루트 디렉터리에서 아래 명령어를 실행해 주세요.

::: code-group

```sh [npm]
npm run dev
```

```sh [pnpm]
pnpm run dev
```

```sh [yarn]
yarn dev
```

명령어를 실행하면 아래와 같은 화면이 표시돼요.
![Metro 실행 예시](/assets/local-develop-js-1.B_LK2Zlw.png)

::: tip 실행 혹은 빌드시 '\[Apps In Toss Plugin] 플러그인 옵션이 올바르지 않습니다' 에러가 발생한다면?
'\[Apps In Toss Plugin] 플러그인 옵션이 올바르지 않습니다. granite.config.ts 구성을 확인해주세요.'\
라는 메시지가 보인다면, `granite.config.ts`의 `icon` 설정을 확인해주세요.\
아이콘을 아직 정하지 않았다면 ''(빈 문자열)로 비워둔 상태로도 테스트할 수 있어요.

```ts
...
displayName: 'test-app', // 화면에 노출될 앱의 한글 이름으로 바꿔주세요.
primaryColor: '#3182F6', // 화면에 노출될 앱의 기본 색상으로 바꿔주세요.
icon: '',// 화면에 노출될 앱의 아이콘 이미지 주소로 바꿔주세요.
...
```

:::

### 개발 서버를 실기기에서 접근 가능하게 설정하기

실기기에서 테스트하려면 번들러를 실행할 때 `--host` 옵션을 활성화하고, `web.host`를 실 기기에서 접근할 수 있는 네트워크 주소로 설정해야 해요.

```ts [granite.config.ts]
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'ping-pong',
  web: {
    host: '192.168.0.100', // 실 기기에서 접근할 수 있는 IP 주소로 변경
    port: 5173,
    commands: {
      dev: 'vite --host', // --host 옵션 활성화
      build: 'vite build',
    },
  },
  permissions: [],
});
```

## 미니앱 실행하기(시뮬레이터·실기기)

:::info 준비가 필요해요
미니앱은 샌드박스 앱을 통해서만 실행되기때문에 **샌드박스 앱(테스트앱)** 설치가 필수입니다.\
개발 및 테스트를 위해 [샌드박스앱](/development/test/sandbox)을 설치해주세요.
:::

### iOS 시뮬레이터(샌드박스앱)에서 실행하기

1. **앱인토스 샌드박스 앱**을 실행해요.
2. 샌드박스 앱에서 스킴을 실행해요. 예를 들어 서비스 이름이 `kingtoss`라면, `intoss://kingtoss`를 입력하고 "스키마 열기" 버튼을 눌러주세요.

아래는 로컬 서버를 실행한 후, iOS 시뮬레이터의 샌드박스앱에서 서버에 연결하는 예시예요.

### iOS 실기기에서 실행하기

### 서버 주소 입력하기

아이폰에서 **앱인토스 샌드박스 앱**을 실행하려면 로컬 서버와 같은 와이파이에 연결되어 있어야 해요. 아래 단계를 따라 설정하세요.

1. **샌드박스 앱**을 실행하면 **"로컬 네트워크" 권한 요청 메시지**가 표시돼요. 이때 **"허용"** 버튼을 눌러주세요.

2) **샌드박스 앱**에서 서버 주소를 입력하는 화면이 나타나요.

3) 컴퓨터에서 로컬 서버 IP 주소를 확인하고, 해당 주소를 입력한 뒤 저장해주세요.
   * IP 주소는 한 번 저장하면 앱을 다시 실행해도 변경되지 않아요.
   * macOS를 사용하는 경우, 터미널에서 `ipconfig getifaddr en0` 명령어로 로컬 서버의 IP 주소를 확인할 수 있어요.

4) **"스키마 열기"** 버튼을 눌러주세요.

5) 화면 상단에 `Bundling {n}%...` 텍스트가 표시되면 로컬 서버에 성공적으로 연결된 거예요.

::: details "로컬 네트워크"를 수동으로 허용하는 방법
**"로컬 네트워크" 권한을 허용하지 못한 경우, 아래 방법으로 수동 설정이 가능해요.**

1. 아이폰의 \[설정] 앱에서 **"앱인토스"** 를 검색해 이동해요.
2. **"로컬 네트워크"** 옵션을 찾아 켜주세요.

:::

***

### Android 실기기 또는 에뮬레이터 연결하기

1. Android 실기기(휴대폰 또는 태블릿)를 컴퓨터와 USB로 연결하세요. ([USB 연결 가이드](/development/client/android.html#기기-연결하기))

2. `adb` 명령어를 사용해서 `8081` 포트와 `5173`포트를 연결하고 연결 상태를 확인해요.

   **8081 포트, 5173 포트 연결하기**

   기기가 하나만 연결되어 있다면 아래 명령어만 실행해도 돼요.

   ```shell
   adb reverse tcp:8081 tcp:8081
   adb reverse tcp:5173 tcp:5173
   ```

   특정 기기를 연결하려면 `-s` 옵션과 디바이스 아이디를 추가해요.

   ```shell
   adb -s {디바이스아이디} reverse tcp:8081 tcp:8081
   # 예시: adb -s R3CX30039GZ reverse tcp:8081 tcp:8081
   adb -s {디바이스아이디} reverse tcp:5173 tcp:5173
   # 예시: adb -s R3CX30039GZ reverse tcp:5173 tcp:5173
   ```

   **연결 상태 확인하기**

   연결된 기기와 포트를 확인하려면 아래 명령어를 사용하세요.

   ```shell
   adb reverse --list
   # 연결된 경우 예시: UsbFfs tcp:8081 tcp:8081

   ```

   특정 기기를 확인하려면 `-s` 옵션을 추가해요.

   ```shell
   adb -s {디바이스아이디} reverse --list
   # 예시: adb -s R3CX30039GZ reverse --list

   # 연결된 경우 예시: UsbFfs tcp:8081 tcp:8081
   ```

3. **앱인토스 샌드박스 앱**에서 스킴을 실행하세요. 예를 들어, 서비스 이름이 `kingtoss`라면 `intoss://kingtoss`를 입력하고 실행 버튼을 누르세요.

   아래는 Android 시뮬레이터에서 로컬 서버를 연결한 후 서비스를 표시하는 예시예요.

### 자주 쓰는 `adb` 명령어 (Android)

개발 중에 자주 쓰는 `adb` 명령어를 정리했어요.

#### 연결 끊기

```shell
adb kill-server
```

#### 8081 포트 연결하기

```shell
adb reverse tcp:8081 tcp:8081
adb reverse tcp:5173 tcp:5173
# 특정 기기 연결: adb -s {디바이스아이디} reverse tcp:8081 tcp:8081
```

#### 연결 상태 확인하기

```shell
adb reverse --list
# 특정 기기 확인: adb -s {디바이스아이디} reverse --list
```

### 트러블슈팅

::: details Q. `서버에 연결할 수 없습니다` 에러가 발생해요.

`granite.config.ts` 의 `web.commands`에 '--host'를 추가 후, 서비스를 실행하여 어떤 호스트 주소로 서비스가 실행되는지 확인해요

```tsx
// granite.config.ts
  web: {
    ...
    commands: {
      dev: 'vite --host', // --host를 추가해요.
      build: 'tsc -b && vite build',
    },
    ...
  },
```

'--host' 추가 후, 서비스를 실행하여 주소를 확인해요

```tsx
// granite.config.ts
  web: {
     host: 'x.x.x.x', // 서비스가 실행되는 호스트 주소를 입력해요.
     ...
  },
```

샌드박스 앱에서 서비스 실행 전, metro 서버 주소도 호스트 주소로 변경해주세요.
:::

::: details Q. Metro 개발 서버가 열려 있는데 `잠시 문제가 생겼어요`라는 메시지가 표시돼요.

개발 서버에 제대로 연결되지 않은 문제일 수 있어요. `adb` 연결을 끊고 다시 `8081` 포트를 연결하세요.
:::

::: details Q. PC웹에서 Not Found 오류가 발생해요.

8081 포트는 샌드박스 내에서 인식하기 위한 포트예요.\
PC웹에서 8081 포트는 Not Found 오류가 발생해요.
:::

## 토스앱에서 테스트하기

토스앱에서 테스트하는 방법은 [토스앱](/development/test/toss) 문서를 참고하세요.

## 출시하기

출시하는 방법은 [미니앱 출시](/development/deploy) 문서를 참고하세요.
