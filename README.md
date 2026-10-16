<div align="center">

<img width="80" alt="wiki" src="https://github.com/user-attachments/assets/4869d211-fae2-4e93-8275-de433556feb0" />
<h1>Frappe Wiki · 中文定制版</h1>

**面向 ERPNext 的文档 / Wiki 应用（中文优先）**

</div>

## 这是什么

[Frappe Wiki](https://github.com/frappe/wiki)（v3.4.0）的工作副本，跑在我们自己的 ERPNext 上，
做了三类改造：**中文优先的界面**、**一批上游没有的功能**、**面向外部访客的公开门户**。

本仓库是独立历史（不是 fork 镜像），上游只作为后续同步来源。上游原有的编辑器、渲染、
同步、统计等基础能力没有重写，改造全部按下面的清单叠加，逐项记录在 `specs/` 里。

## 相对上游改了什么

### 一、中文优先（上游没有）

- 应用自带 `zh` 词条目录（`wiki/locale/zh.po`），界面、服务端消息、前端 SPA 全部接入翻译；
- **覆盖率闸门** `wiki/wiki/test_i18n_coverage.py`：默认只提示，设 `WIKI_I18N_STRICT=1`
  时，凡是"提取出来却没有译文"的字符串会让检查失败 —— 这是发版前该跑的那道关；
- 原先硬编码的文案已经接入：编辑器工具栏、斜杠菜单、链接弹窗、相对时间戳等；
- e2e 固定英文运行、结束后还原站点语言，避免测试结果随语言漂移；
- 设计记录：`specs/i18n_chinese_first.md`。

### 二、上游没有的功能（Alexandrie 特性移植）

程序索引与"现状取证"见 `specs/alexandrie_port/README.md`。**Alexandrie 只作为行为参照，
没有一行代码被搬过来** —— 每一项都在 Frappe + Tiptap 这套栈上重新实现。

| 功能 | 说明 | spec |
| --- | --- | --- |
| LaTeX 数学公式 | 编辑器数学节点 + KaTeX；**服务端排版，导出的 PDF 里也带公式** | `01` |
| 代码片段 Snippets | `Wiki Snippet` 存储 + 属主隔离；斜杠菜单插入，可就地编辑 / 删除 | `02` |
| 语音输入 | Web Speech API，直接口述进编辑器 | `02` |
| 在编辑器里改图 | 补齐 mermaid 节点的编辑体验（含"失效编辑"的回归测试） | `02` |
| 全文搜索进命令面板 | Ctrl+K 直接出**正文片段 + 相关度**；Overview 仪表盘同样可搜 | `03` |
| 检索即时性 | 保存即入索引（不再等下一次定时重建） | `03` |
| 看板任务板 | `Wiki Task` + 空间任务看板，可拖拽排序 | `04` |
| 附件与可移植性 | 挂载 / 预览任意文件；读者端渲染音频、文本 / 代码；**空间导出为 ZIP、导入 ZIP（同路由冲突自动重映射）** | `06` |
| OIDC 单点登录 | 接入方案与操作手册 | `07` |

未纳入的两项：`05` 页面级 ACL（被变更请求工作阻塞）、`08` 离线 PWA（跟随上游 local-first 规划）。

### 三、对外公开（上游没有）

让外部客户**免登录**看公开文档：

- `Wiki Space.visibility` 三态：`Private` / `Logged in` / `Public`。"配了角色行"本身就是门禁，
  三态只决定**没配角色**时的行为，`Public` 必须显式选；迁移补丁保持既有行为不变
  （有角色行 → `Private`，没有 → `Logged in`）；
- `/portal` 公开门户页：展示公开空间卡片（图标 + 名称 + 页面数）；
- `Wiki Portal` 单文档可配：标题 / 副标题 / Logo / 主题色 / 精选空间与排序 / 页脚 ——
  **在应用自己的设置面板里改**（侧栏菜单 → Settings → Portal）；
- 公开空间在自身路由下渲染**目录页**（列出其已发布页面）；非公开空间保持原有的 302 跳转行为；
- 爬虫侧无需额外配置：`sitemap.xml` 与 `llms.txt` 本来就按"访客可读"取数，公开空间会自动进入；
- 设计记录：`specs/public_portal.md`。

### 四、进行中

变更请求 + 三方合并（GitBook 式）：需求与决策见 `prd.md`，当前状态见 `progress.txt`。

## 上游仍然负责什么

Tiptap 编辑器、mermaid / callout / 表格 / 任务列表、Git / GitHub 单向同步、页面浏览统计、
反馈、修订历史与 diff 都来自上游 v3.4.0（MIT）。

## 安装

仓库名（`erpnext-wiki`）与 app 名（`wiki`）不同，而 `bench get-app` 是「克隆目录用仓库名、
安装时用 app 名拼路径」，两者不一致时最后那步会找不到目录，所以手动克隆：

```bash
cd ~/frappe-bench
git clone https://github.com/0409linxiansheng/erpnext-wiki.git apps/wiki
env/bin/python -m pip install -e apps/wiki
echo wiki >> sites/apps.txt
bench --site <站点> install-app wiki
```

已经在用的 bench 不需要重装：`cd apps/wiki && git pull`，再跑一次
`bench --site <站点> migrate` 即可。

## 测试

```bash
# 单元测试
bench --site <站点> run-tests --app wiki

# 端到端（会临时把站点语言固定为英文，结束后还原）
./scripts/e2e-local.sh
```

发版前建议带闸门跑一次 i18n 覆盖率：

```bash
WIKI_I18N_STRICT=1 bench --site <站点> run-tests --app wiki --module wiki.wiki.test_i18n_coverage
```

## 文档在哪

| 文件 | 内容 |
| --- | --- |
| `specs/` | 每个特性的设计记录：现状取证、决策、完成日志 |
| `specs/alexandrie_port/` | 特性移植程序索引与特性矩阵 |
| `specs/public_portal.md` | 公开门户与空间可见性 |
| `specs/i18n_chinese_first.md` | 中文优先与覆盖率闸门 |
| `prd.md` / `progress.txt` | 变更请求与三方合并 |
| `ARCHITECTURE.md` | 架构说明 |

## 上游致谢

基于 Frappe 团队的 [frappe/wiki](https://github.com/frappe/wiki)（MIT License）。
上游产品文档：<https://docs.frappe.io/wiki-v2/>，源码：<https://github.com/frappe/wiki>。
