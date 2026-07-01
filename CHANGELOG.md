# [0.6.0](https://github.com/subhro-kar/site-doctor/compare/v0.5.0...v0.6.0) (2026-07-01)


### Features

* add performance check (LCP, CLS, INP, render-blocking, bundle size, DOM size, compression, third-party) ([#9](https://github.com/subhro-kar/site-doctor/issues/9)) ([30d2b64](https://github.com/subhro-kar/site-doctor/commit/30d2b6482f8e5ed3145a3e53ddbca77e87f2edf6))

# [0.5.0](https://github.com/subhro-kar/site-doctor/compare/v0.4.1...v0.5.0) (2026-07-01)


### Features

* release interactive CLI mode, check filtering, and design issues audit ([67a673d](https://github.com/subhro-kar/site-doctor/commit/67a673ddefc88870a1e644ed2dcebdd309cb454f))

## [0.4.1](https://github.com/subhro-kar/site-doctor/compare/v0.4.0...v0.4.1) (2026-07-01)


### Bug Fixes

* simplify release pipeline to single job, enable npm publish, remove duplicate github-release job ([0f6e852](https://github.com/subhro-kar/site-doctor/commit/0f6e852405d7e199c89181d415fa24928615a27d))

# [0.4.0](https://github.com/subhro-kar/site-doctor/compare/v0.3.4...v0.4.0) (2026-07-01)


### Features

* add design issues check (typography, headings, contrast, touch,… ([#6](https://github.com/subhro-kar/site-doctor/issues/6)) ([25b183d](https://github.com/subhro-kar/site-doctor/commit/25b183d3881cb0bc6bdf036f70b043b1435697e9))

## [0.3.4](https://github.com/subhro-kar/site-doctor/compare/v0.3.3...v0.3.4) (2026-06-29)


### Bug Fixes

* 3-job pipeline - release then npm publish then github release ([d8d218e](https://github.com/subhro-kar/site-doctor/commit/d8d218e25a0f4e4f8ba9368ef0d38099fab89c7b))
* single job, semantic-release handles npm publish and github release ([bdf3c9f](https://github.com/subhro-kar/site-doctor/commit/bdf3c9f4bbe3dc5106f337806022b1c376c2c5e8))
* write .npmrc for semantic-release npm auth ([d22fdeb](https://github.com/subhro-kar/site-doctor/commit/d22fdebee2f4f697f55261680df553a576aa6bc9))

## [0.3.3](https://github.com/subhro-kar/site-doctor/compare/v0.3.2...v0.3.3) (2026-06-29)


### Bug Fixes

* always publish to npm after successful release ([2a5f928](https://github.com/subhro-kar/site-doctor/commit/2a5f928164c4eac3dea9237ab1db7155e8a24717))

## [0.3.2](https://github.com/subhro-kar/site-doctor/compare/v0.3.1...v0.3.2) (2026-06-29)


### Bug Fixes

* single job with two labeled steps, semantic-release for versioning only ([5bc80b7](https://github.com/subhro-kar/site-doctor/commit/5bc80b7d46689ebe58b9c6f0b4c66f55b30da93f))

## [0.3.1](https://github.com/subhro-kar/site-doctor/compare/v0.3.0...v0.3.1) (2026-06-29)


### Bug Fixes

* publish to npm before creating GitHub release ([fe531eb](https://github.com/subhro-kar/site-doctor/commit/fe531ebbfc22c6181c067b48cc0ec2fe2f39ee4a))
* single release job with labeled steps for version and publish ([81ae6fb](https://github.com/subhro-kar/site-doctor/commit/81ae6fb1ef2aa86537a28a81353776f355280caf))

# [0.3.0](https://github.com/subhro-kar/site-doctor/compare/v0.2.0...v0.3.0) (2026-06-29)


### Features

* separate release and publish into distinct jobs ([9fd8a4a](https://github.com/subhro-kar/site-doctor/commit/9fd8a4aa52ef9aea52353f3eb2d4e450ae50b33e))

# [0.2.0](https://github.com/subhro-kar/site-doctor/compare/v0.1.6...v0.2.0) (2026-06-29)


### Bug Fixes

* pin action SHAs and set pnpm version in CI ([3e83464](https://github.com/subhro-kar/site-doctor/commit/3e83464342f23b54f79b5aae275f93ce786b8654))
* remove explicit pnpm version from action ([5bcb9cc](https://github.com/subhro-kar/site-doctor/commit/5bcb9ccb4f234c758d2f84450f17de790436c3b9))
* require Node >= 22.13 (pnpm 11 compat) ([c34f53d](https://github.com/subhro-kar/site-doctor/commit/c34f53d42c5a3b3054d07db3db2a87af604260ff))


### Features

* add automatic changelog generation via semantic-release ([afc851b](https://github.com/subhro-kar/site-doctor/commit/afc851b31932a95bc60ac8fbcdc0d12edd505025))
* add manual dispatch trigger to release workflow ([c315a0d](https://github.com/subhro-kar/site-doctor/commit/c315a0d89eaffb9564f77593cb3d9a9a7c857e4e))
* add MCP server and improve package visibility ([1b6f230](https://github.com/subhro-kar/site-doctor/commit/1b6f2307547fc487b7cbf7ce0f93b44405790cac))
* auto-release on merge to main ([a9f1b78](https://github.com/subhro-kar/site-doctor/commit/a9f1b782984966705f0db0ebfcd90edaec135a41))
* use semantic-release for automated versioning and publishing ([fa1826a](https://github.com/subhro-kar/site-doctor/commit/fa1826affde1c9d0f4b1df4d595d0f392dc65180))
