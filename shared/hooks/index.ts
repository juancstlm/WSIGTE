export const useIsDev = () => {
    return process.env.NODE_ENV === 'development'
}