import { ReleaseInfo } from '../types';
import { InstallStage } from '../lib/update';
import { Icon } from './Icon';

interface UpdateBannerProps {
  release: ReleaseInfo;
  installing: boolean;
  stage?: InstallStage | null;
  onInstall: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ release, installing, stage, onInstall, onDismiss }: UpdateBannerProps) {
  const action =
    stage === 'downloading' ? 'Скачивание…' : stage === 'opening' ? 'Установщик…' : 'Обновить';

  return (
    <div className="update-banner" role="status">
      <div className="update-banner__icon">
        <Icon name="download" size={18} />
      </div>
      <div className="update-banner__body">
        <strong>Доступно обновление v{release.version}</strong>
        <span>
          {release.apkUrl
            ? 'APK скачается и откроется системный установщик. Подтвердите установку поверх текущей версии.'
            : 'Опубликован новый релиз. Откройте страницу релиза, чтобы скачать сборку.'}
        </span>
      </div>
      <div className="update-banner__actions">
        <button type="button" className="primary-btn primary-btn--small" onClick={onInstall} disabled={installing}>
          {installing ? <span className="spinner" /> : <Icon name="download" size={15} />}
          {installing ? action : 'Обновить'}
        </button>
        <button type="button" className="icon-btn" onClick={onDismiss} aria-label="Скрыть">
          <Icon name="close" size={17} />
        </button>
      </div>
    </div>
  );
}
