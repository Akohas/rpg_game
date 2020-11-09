export const getStaticFile = (path: string): string => {
    return `${window.location.href}static/${path}`;
}