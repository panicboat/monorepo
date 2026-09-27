use topcoat::{
    Result,
    router::{Router, page},
    view::{View, view},
};

#[tokio::main]
async fn main() {
    let router = Router::builder().page(home).build();
    topcoat::start(router).await.unwrap();
}

#[page("/translate/")]
async fn home() -> Result<impl View> {
    Ok(view! {
        <!DOCTYPE html>
        <html>
            <head>
                <title>"Meeting Translation"</title>
                topcoat::dev::script()
            </head>
            <body>
                <h1>"Meeting Translation"</h1>
            </body>
        </html>
    })
}
