import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { Cloud } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(8, 'Минимум 8 символов'),
  name: z.string().optional()
});

type FormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const { login, register: registerUser, user } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', name: '' }
  });

  const onSubmit = async (values: FormValues) => {
    try {
      if (mode === 'login') {
        await login({ email: values.email, password: values.password });
      } else {
        if (!values.name) {
          throw new Error('Введите имя');
        }
        await registerUser({ email: values.email, password: values.password, name: values.name });
      }
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  if (user) {
    return <Navigate to="/drive" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-500 via-primary-400 to-indigo-500 px-4 py-10">
      <div className="card-glass flex w-full max-w-4xl flex-col overflow-hidden lg:flex-row">
        <div className="flex-1 bg-white/40 p-10 backdrop-blur dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500 text-white shadow-soft">
              <Cloud className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">CloudDrive</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Облачное пространство нового уровня</p>
            </div>
          </div>
          <div className="mt-10 space-y-6 text-slate-600 dark:text-slate-300">
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Современный UX</p>
              <p className="mt-2 text-sm text-slate-500">
                Адаптивный интерфейс, мгновенная синхронизация и продвинутые инструменты коллаборации.
              </p>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Гибкое расшаривание</p>
              <p className="mt-2 text-sm text-slate-500">
                Управляйте доступом к файлам, задавайте права и срок действия публичных ссылок.
              </p>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Безопасность</p>
              <p className="mt-2 text-sm text-slate-500">
                Двухуровневая авторизация, токены обновления и шифрование паролей по стандарту bcrypt.
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 bg-white/80 p-10 backdrop-blur dark:bg-slate-900/80">
          <div className="mb-8 space-y-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {mode === 'login' ? 'Войдите в аккаунт' : 'Создайте аккаунт'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {mode === 'login'
                ? 'Введите учетные данные, чтобы продолжить работу с файлами.'
                : 'Заполните форму и получите доступ к личному облаку.'}
            </p>
          </div>
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            {mode === 'register' && (
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Имя</label>
                <Input placeholder="Марина" {...register('name')} />
                {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>}
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Email</label>
              <Input type="email" placeholder="you@company.com" {...register('email')} />
              {errors.email && <p className="mt-1 text-xs text-rose-500">{errors.email.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Пароль</label>
              <Input type="password" placeholder="••••••••" {...register('password')} />
              {errors.password && <p className="mt-1 text-xs text-rose-500">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {mode === 'login' ? (
              <button className="font-semibold text-primary-600" onClick={() => setMode('register')}>
                Нет аккаунта? Зарегистрируйтесь
              </button>
            ) : (
              <button className="font-semibold text-primary-600" onClick={() => setMode('login')}>
                Уже есть аккаунт? Войдите
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
