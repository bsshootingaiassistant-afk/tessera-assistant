import { useCallback, useEffect, useRef, useState } from 'react';
import { AddIntegrationModal } from './components/AddIntegrationModal';
import { ChatView } from './components/ChatView';
import { FeedbackModal } from './components/FeedbackModal';
import { Icon } from './components/Icon';
import { JobsModal } from './components/JobsModal';
import { ModulesPanel } from './components/ModulesPanel';
import { PythonModal } from './components/PythonModal';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { UpdateBanner } from './components/UpdateBanner';
import { streamAssistant, suggestionsFor } from './lib/assistant';
import { fetchJob, loadJobs, saveJobs, submitJob } from './lib/jobs';
import { testModule } from './lib/modules';
import {
  clearAllData,
  loadActiveChatId,
  loadChats,
  loadDismissedRelease,
  loadModules,
  loadSettings,
  saveActiveChatId,
  saveChats,
  saveDismissedRelease,
  saveModules,
  saveSettings,
  seededChats,
  seededModules,
} from './lib/store';
import { checkForRelease, installRelease, isNewerVersion, InstallStage } from './lib/update';
import { cls, truncate, uid } from './lib/utils';
import { Chat, ChatMessage, ModuleIntegration, ModuleKind, ReleaseInfo, RemoteJob, Settings } from './types';

type ToastKind = 'info' | 'success' | 'error';

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => {
    const loaded = loadSettings();
    const themeParam = new URLSearchParams(window.location.search).get('theme');
    if (themeParam === 'light' || themeParam === 'dark') {
      loaded.theme = themeParam;
    }
    return loaded;
  });
  const [modules, setModules] = useState<ModuleIntegration[]>(loadModules);
  const [chats, setChats] = useState<Chat[]>(loadChats);
  const [activeChatId, setActiveChatId] = useState<string>(() => {
    const stored = loadActiveChatId();
    const initial = loadChats();
    return stored && initial.some((chat) => chat.id === stored) ? stored : initial[0]?.id ?? '';
  });

  const [modulesOpen, setModulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [initialKind, setInitialKind] = useState<ModuleKind | undefined>(undefined);
  const [editingModule, setEditingModule] = useState<ModuleIntegration | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installStage, setInstallStage] = useState<InstallStage | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackPage, setFeedbackPage] = useState('Чат');
  const [pythonOpen, setPythonOpen] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [jobs, setJobs] = useState<RemoteJob[]>(loadJobs);
  const [jobSubmitting, setJobSubmitting] = useState(false);
  const [toast, setToast] = useState<{ kind: ToastKind; text: string } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const notifiedJobs = useRef<Set<string>>(new Set());

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? chats[0];

  const notify = useCallback((text: string, kind: ToastKind = 'info') => {
    setToast({ text, kind });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveModules(modules), [modules]);
  useEffect(() => saveChats(chats), [chats]);
  useEffect(() => saveJobs(jobs), [jobs]);

  useEffect(() => {
    const active = jobs.filter((job) => job.status === 'queued' || job.status === 'running');
    if (active.length === 0 || !settings.apiBase.trim() || !settings.apiKey.trim()) return;

    let cancelled = false;
    const tick = async () => {
      for (const job of active) {
        try {
          const update = await fetchJob(settings, job.id);
          if (cancelled) return;
          setJobs((prev) => {
            let changed = false;
            const next = prev.map((item) => {
              if (item.id !== job.id) return item;
              const status = update.status ?? item.status;
              const result = update.result ?? item.result;
              const error = update.error ?? item.error;
              if (status === item.status && result === item.result && error === item.error) {
                return item;
              }
              changed = true;
              return { ...item, status, result, error, updatedAt: Date.now() };
            });
            return changed ? next : prev;
          });
          if (update.status === 'done' && !notifiedJobs.current.has(job.id)) {
            notifiedJobs.current.add(job.id);
            const result = update.result ?? '';
            notify('Задача на ПК готова', 'success');
            setChats((prev) =>
              prev.map((chat) =>
                chat.id === activeChatId
                  ? {
                      ...chat,
                      updatedAt: Date.now(),
                      messages: [
                        ...chat.messages,
                        {
                          id: uid('msg'),
                          role: 'assistant',
                          createdAt: Date.now(),
                          content: `**Задача на ПК завершена**\n\n${result.slice(0, 8000)}`,
                        },
                      ],
                    }
                  : chat,
              ),
            );
            try {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Tessera: задача на ПК готова', {
                  body: job.prompt.slice(0, 140),
                });
              }
            } catch {
              // WebView may not expose Notification.
            }
          }
        } catch {
          // Worker may be offline; keep the job and retry on next tick.
        }
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [jobs, settings, activeChatId, notify]);
  useEffect(() => {
    if (activeChatId) saveActiveChatId(activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.accent = settings.accent;
      document.documentElement.dataset.compact = settings.compact ? 'true' : 'false';
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0b0f14' : '#f6f7fb');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme, settings.accent, settings.compact]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        newChat();
      }
      if (mod && event.key === ',') {
        event.preventDefault();
        setSettingsOpen(true);
      }
      if (event.key === 'Escape') {
        setModulesOpen(false);
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (!settings.autoUpdate) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const latest = await checkForRelease();
      if (cancelled || !latest) return;
      if (isNewerVersion(latest.version, __APP_VERSION__) && latest.version !== loadDismissedRelease()) {
        setRelease(latest);
      }
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [settings.autoUpdate]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const newChat = () => {
    const chat: Chat = {
      id: uid('chat'),
      title: 'Новый чат',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    setSidebarOpen(false);
    setModulesOpen(false);
  };

  const selectChat = (id: string) => {
    setActiveChatId(id);
    setSidebarOpen(false);
  };

  const deleteChat = (id: string) => {
    const remaining = chats.filter((chat) => chat.id !== id);
    if (remaining.length === 0) {
      const fresh = seededChats();
      setChats(fresh);
      setActiveChatId(fresh[0].id);
      return;
    }
    setChats(remaining);
    if (id === activeChatId) setActiveChatId(remaining[0].id);
  };

  const patchMessage = (chatId: string, messageId: string, patch: Partial<ChatMessage>) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              updatedAt: Date.now(),
              messages: chat.messages.map((message) =>
                message.id === messageId ? { ...message, ...patch } : message,
              ),
            }
          : chat,
      ),
    );
  };

  const sendMessage = async (raw: string) => {
    const text = raw.trim();
    if (!text || isStreaming) return;
    const chat = activeChat;
    if (!chat) return;

    const userMessage: ChatMessage = {
      id: uid('msg'),
      role: 'user',
      content: text,
      createdAt: Date.now(),
    };
    const assistantId = uid('msg');
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      pending: true,
    };

    const isFirstUserMessage = !chat.messages.some((message) => message.role === 'user');
    setChats((prev) =>
      prev.map((item) =>
        item.id === chat.id
          ? {
              ...item,
              title: isFirstUserMessage ? truncate(text, 48) : item.title,
              updatedAt: Date.now(),
              messages: [...item.messages, userMessage, assistantMessage],
            }
          : item,
      ),
    );

    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);

    let accumulated = '';
    try {
      const history = [...chat.messages, userMessage];
      for await (const chunk of streamAssistant({
        messages: history,
        modules,
        settings,
        signal: controller.signal,
      })) {
        if (controller.signal.aborted) break;
        accumulated += chunk;
        patchMessage(chat.id, assistantId, { content: accumulated });
      }
      patchMessage(chat.id, assistantId, {
        pending: false,
        content: accumulated || 'Не удалось получить ответ. Попробуйте ещё раз.',
        suggestions: suggestionsFor(text),
      });
    } catch (error) {
      if (controller.signal.aborted) {
        patchMessage(chat.id, assistantId, {
          pending: false,
          content: accumulated || 'Генерация остановлена.',
          suggestions: suggestionsFor(text),
        });
      } else {
        const message = error instanceof Error ? error.message : String(error);
        patchMessage(chat.id, assistantId, {
          pending: false,
          error: true,
          content: `Не удалось получить ответ от API.\n\n\`${message}\`\n\nПроверьте адрес и ключ в настройках или очистите поле **API endpoint**, чтобы работать офлайн.`,
          suggestions: ['Открой настройки', 'Что ты умеешь?'],
        });
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  };

  const openAdd = (kind?: ModuleKind) => {
    setEditingModule(null);
    setInitialKind(kind);
    setAddOpen(true);
    setModulesOpen(false);
  };

  const openEdit = (module: ModuleIntegration) => {
    setEditingModule(module);
    setInitialKind(module.kind);
    setAddOpen(true);
  };

  const saveModule = (module: ModuleIntegration) => {
    setModules((prev) => {
      const exists = prev.some((item) => item.id === module.id);
      return exists ? prev.map((item) => (item.id === module.id ? module : item)) : [module, ...prev];
    });
    setAddOpen(false);
    notify(editingModule ? 'Модуль обновлён' : 'Модуль добавлен', 'success');
  };

  const toggleModule = (id: string) => {
    setModules((prev) =>
      prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item)),
    );
  };

  const deleteModule = (id: string) => {
    const target = modules.find((module) => module.id === id);
    if (!target) return;
    if (!window.confirm(`Удалить модуль «${target.name}»?`)) return;
    setModules((prev) => prev.filter((module) => module.id !== id));
    notify('Модуль удалён');
  };

  const testModuleById = async (id: string) => {
    const module = modules.find((item) => item.id === id);
    if (!module) return;
    setModules((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'checking' } : item)));
    const result = await testModule(module);
    setModules((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: result.status, lastCheckedAt: Date.now() } : item,
      ),
    );
    notify(result.message, result.status === 'connected' ? 'success' : 'error');
  };

  const saveSettingsAndApply = (next: Settings) => {
    setSettings(next);
    notify('Настройки сохранены', 'success');
  };

  const submitRemoteJob = async (prompt: string) => {
    setJobSubmitting(true);
    try {
      const job = await submitJob(settings, prompt);
      setJobs((prev) => [job, ...prev]);
      notify('Задача отправлена на ПК', 'success');
      try {
        if ('Notification' in window && Notification.permission === 'default') {
          void Notification.requestPermission();
        }
      } catch {
        // WebView may not expose Notification.
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Не удалось отправить задачу', 'error');
    } finally {
      setJobSubmitting(false);
    }
  };

  const refreshRemoteJobs = async () => {
    const active = jobs.filter((job) => job.status === 'queued' || job.status === 'running');
    for (const job of active) {
      try {
        const update = await fetchJob(settings, job.id);
        setJobs((prev) =>
          prev.map((item) =>
            item.id === job.id
              ? {
                  ...item,
                  status: update.status ?? item.status,
                  result: update.result ?? item.result,
                  error: update.error ?? item.error,
                  updatedAt: Date.now(),
                }
              : item,
          ),
        );
      } catch {
        notify('Worker не отвечает', 'error');
        return;
      }
    }
    notify('Статусы обновлены');
  };

  const clearRemoteJobs = () => {
    setJobs((prev) => prev.filter((job) => job.status === 'queued' || job.status === 'running'));
    notify('История задач очищена');
  };

  const useRemoteJobResult = (result: string) => {
    const chat = activeChat;
    if (!chat) return;
    setChats((prev) =>
      prev.map((item) =>
        item.id === chat.id
          ? {
              ...item,
              updatedAt: Date.now(),
              messages: [
                ...item.messages,
                {
                  id: uid('msg'),
                  role: 'assistant',
                  createdAt: Date.now(),
                  content: `**Результат с ПК**\n\n${result.slice(0, 8000)}`,
                },
              ],
            }
          : item,
      ),
    );
    setJobsOpen(false);
    notify('Результат добавлен в чат', 'success');
  };

  const checkUpdates = async () => {
    const latest = await checkForRelease();
    if (!latest) {
      notify('Не удалось проверить обновления. Проверьте VITE_GITHUB_REPO.', 'error');
      return;
    }
    if (isNewerVersion(latest.version, __APP_VERSION__)) {
      setRelease(latest);
      saveDismissedRelease('');
      notify(`Доступна версия v${latest.version}`, 'info');
      if (settings.autoInstall) {
        setTimeout(() => void runInstall(latest), 350);
      }
    } else {
      notify('У вас последняя версия', 'success');
    }
  };

  const runInstall = async (target: ReleaseInfo | null = release) => {
    if (!target) return;
    setInstalling(true);
    setInstallStage('downloading');
    notify(`Скачиваю APK v${target.version}…`, 'info');
    const result = await installRelease(target, (stage) => {
      setInstallStage(stage);
      if (stage === 'opening') notify('Открываю системный установщик…', 'info');
    });
    setInstalling(false);
    setInstallStage(null);
    if (result === 'installed') notify('Установщик APK открыт', 'success');
    else if (result === 'opened') notify('Загрузка открыта в браузере', 'info');
    else notify('Не удалось запустить установку. Скачайте APK вручную.', 'error');
  };

  const dismissRelease = () => {
    if (release) saveDismissedRelease(release.version);
    setRelease(null);
  };

  const exportData = () => {
    const payload = {
      app: 'tessera',
      version: __APP_VERSION__,
      exportedAt: new Date().toISOString(),
      settings,
      modules,
      chats,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tessera-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify('Экспорт готов', 'success');
  };

  const clearData = () => {
    clearAllData();
    const freshSettings = loadSettings();
    const freshModules = seededModules();
    const freshChats = seededChats();
    setSettings(freshSettings);
    setModules(freshModules);
    setChats(freshChats);
    setActiveChatId(freshChats[0].id);
    notify('Все данные очищены');
  };

  const currentPage = settingsOpen
    ? 'Настройки'
    : addOpen
      ? 'Новый модуль'
      : modulesOpen
        ? 'Модули'
        : 'Чат';

  const openFeedback = (page = currentPage) => {
    setFeedbackPage(page);
    setFeedbackOpen(true);
  };

  const openFeedbackFromSettings = (next: Settings) => {
    setSettings(next);
    setSettingsOpen(false);
    openFeedback('Настройки');
    notify('Режим разработчика включён', 'success');
  };

  const handleSuggestion = (text: string) => {
    if (/открой настройк/i.test(text)) {
      setSettingsOpen(true);
      return;
    }
    void sendMessage(text);
  };

  if (!activeChat) return null;

  return (
    <div className={cls('app', settings.compact && 'app--compact')}>
      <Sidebar
        chats={chats}
        activeChatId={activeChat.id}
        modulesCount={modules.length}
        activeModules={modules.filter((module) => module.enabled).length}
        onNewChat={newChat}
        onSelectChat={selectChat}
        onDeleteChat={deleteChat}
        onOpenModules={() => setModulesOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onClose={() => setSidebarOpen(false)}
        isMobileOpen={sidebarOpen}
      />

      <ChatView
        chat={activeChat}
        modules={modules}
        settings={settings}
        isStreaming={isStreaming}
        onSend={sendMessage}
        onStop={stopStreaming}
        onOpenModules={() => setModulesOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenPython={() => setPythonOpen(true)}
        onOpenJobs={() => setJobsOpen(true)}
        onOpenSidebar={() => setSidebarOpen(true)}
        onSuggestion={handleSuggestion}
        onNewChat={newChat}
      />

      <ModulesPanel
        modules={modules}
        isOpen={modulesOpen}
        onClose={() => setModulesOpen(false)}
        onAdd={openAdd}
        onEdit={openEdit}
        onToggle={toggleModule}
        onDelete={deleteModule}
        onTest={testModuleById}
      />

      <AddIntegrationModal
        open={addOpen}
        initialKind={initialKind}
        editing={editingModule}
        onClose={() => setAddOpen(false)}
        onSave={saveModule}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettingsAndApply}
        onCheckUpdate={checkUpdates}
        onClearData={clearData}
        onExport={exportData}
        onOpenFeedback={openFeedbackFromSettings}
      />

      {settings.developerMode && !feedbackOpen && (
        <button
          type="button"
          className="feedback-fab"
          onClick={() => openFeedback()}
          aria-label="Отправить отзыв"
          title="Отправить отзыв"
        >
          <Icon name="chat" size={18} />
          <span>Отзыв</span>
        </button>
      )}

      <FeedbackModal
        open={feedbackOpen}
        page={feedbackPage}
        settings={settings}
        modules={modules}
        onClose={() => setFeedbackOpen(false)}
        onResult={notify}
      />

      <PythonModal
        open={pythonOpen}
        onClose={() => setPythonOpen(false)}
        onResult={notify}
      />

      <JobsModal
        open={jobsOpen}
        settings={settings}
        jobs={jobs}
        submitting={jobSubmitting}
        onClose={() => setJobsOpen(false)}
        onSubmit={submitRemoteJob}
        onRefresh={refreshRemoteJobs}
        onClear={clearRemoteJobs}
        onUseResult={useRemoteJobResult}
      />

      {release && (
        <UpdateBanner
          release={release}
          installing={installing}
          stage={installStage}
          onInstall={() => void runInstall()}
          onDismiss={dismissRelease}
        />
      )}

      {toast && (
        <div className={cls('toast', `toast--${toast.kind}`)} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}
