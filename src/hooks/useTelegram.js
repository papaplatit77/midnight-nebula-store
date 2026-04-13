const tg = typeof window !== 'undefined' && window.Telegram?.WebApp;

export function useTelegram() {
  const user = tg?.initDataUnsafe?.user ?? null;

  return {
    tg,
    user,
    username: user?.username ? `@${user.username}` : user?.first_name ?? null,
    userId: user?.id ?? null,
    isReady: !!tg,
    expand: () => tg?.expand(),
    close: () => tg?.close(),
  };
}
