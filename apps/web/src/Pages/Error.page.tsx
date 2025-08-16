import { useRouteError } from 'react-router-dom';

const ErrorPage = () => {
  const error = useRouteError() as { statusText?: string; message?: string };
  console.error(error);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-4xl font-bold mb-4">Oops!</h1>
      <div className="text-xl mb-2">Sorry, an unexpected error has occurred.</div>
      <div className="text-gray-500">
        <div>
          {error.statusText || error.message}
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;