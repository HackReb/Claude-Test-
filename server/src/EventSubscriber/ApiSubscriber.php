<?php

namespace App\EventSubscriber;

use App\Service\StreetTakenException;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * CORS für die PWA (läuft auf einer anderen Domain, z. B. GitHub Pages)
 * und Fehler als JSON statt als HTML-Seite.
 */
final class ApiSubscriber implements EventSubscriberInterface
{
    /** @var list<string> */
    private readonly array $allowedOrigins;

    public function __construct(string $corsAllowOrigin)
    {
        $this->allowedOrigins = array_values(array_filter(array_map('trim', explode(',', $corsAllowOrigin))));
    }

    public static function getSubscribedEvents(): array
    {
        return [
            KernelEvents::REQUEST => ['onRequest', 250],
            KernelEvents::RESPONSE => 'onResponse',
            KernelEvents::EXCEPTION => 'onException',
        ];
    }

    public function onRequest(RequestEvent $event): void
    {
        $request = $event->getRequest();
        if ($event->isMainRequest() && $this->isApi($request) && 'OPTIONS' === $request->getMethod()) {
            $event->setResponse(new Response('', Response::HTTP_NO_CONTENT));
        }
    }

    public function onResponse(ResponseEvent $event): void
    {
        $request = $event->getRequest();
        if (!$this->isApi($request)) {
            return;
        }
        $response = $event->getResponse();
        $response->headers->set('Cache-Control', 'no-store');
        $origin = (string) $request->headers->get('Origin', '');
        if ('' === $origin || !$this->originAllowed($origin)) {
            return;
        }
        $response->headers->set('Access-Control-Allow-Origin', in_array('*', $this->allowedOrigins, true) ? '*' : $origin);
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Babo-Player');
        $response->headers->set('Access-Control-Max-Age', '86400');
        $response->setVary('Origin', false);
    }

    public function onException(ExceptionEvent $event): void
    {
        if (!$this->isApi($event->getRequest())) {
            return;
        }
        $error = $event->getThrowable();
        $status = $error instanceof HttpExceptionInterface ? $error->getStatusCode() : 500;
        $message = $status < 500 ? $error->getMessage() : 'Serverfehler.';
        $headers = $error instanceof HttpExceptionInterface ? $error->getHeaders() : [];
        $body = ['error' => $message];
        if ($error instanceof StreetTakenException) {
            $body['ownerName'] = $error->ownerName;
        }
        $event->setResponse(new JsonResponse($body, $status, $headers));
    }

    private function isApi(Request $request): bool
    {
        return str_starts_with($request->getPathInfo(), '/api/');
    }

    private function originAllowed(string $origin): bool
    {
        return in_array('*', $this->allowedOrigins, true) || in_array($origin, $this->allowedOrigins, true);
    }
}
